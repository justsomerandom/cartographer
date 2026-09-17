import path from "node:path";

import type {
  DependencyAnalysis,
  FileHotspot,
  FileInfo,
  GitSummary,
  HotspotAnalysis,
  HotspotCategory,
  HotspotMetrics,
  HotspotReason,
  HotspotSignalKind,
  HotspotSignals,
  MarkerSummary,
  SourceRelationshipAnalysis,
} from "../../../../types/repository";
import { projectIdForPath } from "../relationships/common";
import { rankMetricPercentiles, roundSignal } from "./normalize";
import { hotspotWeights, scoreSignals, severityForScore, severityForSignal } from "./scoring";

export interface HotspotAnalysisInput {
  files: FileInfo[];
  git: GitSummary;
  markers: MarkerSummary;
  sourceRelationships: SourceRelationshipAnalysis;
  dependencyAnalysis: DependencyAnalysis;
}

const maxHotspots = 30;
const maxCategoryHotspots = 10;
const hotspotSourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".rs",
  ".go",
  ".py",
  ".java",
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".cs",
  ".sh",
  ".bash",
]);

export function analyzeHotspots(input: HotspotAnalysisInput): HotspotAnalysis {
  const candidates = input.files.filter(isHotspotCandidate).sort((a, b) => a.path.localeCompare(b.path));
  const historyByPath = new Map(input.git.fileHistory.map((file) => [file.path, file]));
  const markerCountByPath = new Map(input.markers.files.map((file) => [file.path, file.count]));
  const moduleByPath = new Map(input.sourceRelationships.modules.map((module) => [module.path, module]));
  const cyclePaths = new Set(input.sourceRelationships.cycles.flatMap((cycle) => cycle.modules));
  const testPaths = new Set(candidates.filter((file) => isTestFile(file.path)).map((file) => file.path));

  const touchRanks = rankMetricPercentiles(candidates.map((file) => ({ path: file.path, value: historyByPath.get(file.path)?.touchCount ?? 0 })));
  const recentRanks = rankMetricPercentiles(candidates.map((file) => ({ path: file.path, value: historyByPath.get(file.path)?.recentTouchCount ?? 0 })));
  const authorRanks = rankMetricPercentiles(candidates.map((file) => ({ path: file.path, value: historyByPath.get(file.path)?.authors.length ?? 0 })));
  const incomingRanks = rankMetricPercentiles(candidates.map((file) => ({ path: file.path, value: moduleByPath.get(file.path)?.incomingCount ?? 0 })));
  const outgoingRanks = rankMetricPercentiles(candidates.map((file) => ({ path: file.path, value: moduleByPath.get(file.path)?.outgoingCount ?? 0 })));
  const sizeRanks = rankMetricPercentiles(candidates.map((file) => ({ path: file.path, value: file.bytes })));
  const markerDensityRanks = rankMetricPercentiles(
    candidates.map((file) => ({
      path: file.path,
      value: markerDensity(markerCountByPath.get(file.path) ?? 0, file.lineCount),
    })),
  );

  const allHotspots = candidates
    .map((file) => {
      const history = historyByPath.get(file.path);
      const sourceModule = moduleByPath.get(file.path);
      const markerCount = markerCountByPath.get(file.path) ?? 0;
      const fileIsTest = isTestFile(file.path);
      const hasLikelyTest = fileIsTest ? null : hasLikelyRelatedTest(file.path, testPaths);
      const metrics: HotspotMetrics = {
        touchCount: history?.touchCount,
        recentTouchCount: history?.recentTouchCount,
        authorCount: history?.authors.length,
        bytes: file.bytes,
        lineCount: file.lineCount,
        markerCount,
        markerDensity: markerDensity(markerCount, file.lineCount),
        incomingCount: sourceModule?.incomingCount ?? 0,
        outgoingCount: sourceModule?.outgoingCount ?? 0,
        inCycle: cyclePaths.has(file.path),
        isTestFile: fileIsTest,
        hasLikelyTest,
      };
      const signals: HotspotSignals = {
        churn: touchRanks.get(file.path)?.percentile ?? 0,
        recentActivity: recentRanks.get(file.path)?.percentile ?? 0,
        incomingCentrality: incomingRanks.get(file.path)?.percentile ?? 0,
        outgoingCoupling: outgoingRanks.get(file.path)?.percentile ?? 0,
        size: sizeRanks.get(file.path)?.percentile ?? 0,
        markerDensity: markerDensityRanks.get(file.path)?.percentile ?? 0,
        cycleMembership: metrics.inCycle ? 1 : 0,
        contributorSpread: authorRanks.get(file.path)?.percentile ?? 0,
        testAwareness: !fileIsTest && hasLikelyTest === false ? 1 : 0,
      };
      const score = scoreSignals(signals);

      return {
        rank: 0,
        path: file.path,
        language: file.language,
        projectId: sourceModule?.projectId ?? projectIdForPath(file.path, input.dependencyAnalysis.projects),
        score,
        severity: severityForScore(score),
        signals,
        metrics,
        reasons: hotspotReasons(file.path, signals, metrics),
      } satisfies FileHotspot;
    })
    .filter((hotspot) => hotspot.score > 0 || hotspot.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .map((hotspot, index) => ({ ...hotspot, rank: index + 1 }));

  const hotspots = allHotspots.slice(0, maxHotspots);

  return {
    summary: {
      filesAnalyzed: candidates.length,
      hotspotsSurfaced: hotspots.length,
      highestChurnFile: topBySignal(allHotspots, "churn")?.path,
      mostDependedOnModule: topBySignal(allHotspots, "incomingCentrality")?.path,
      highestFanOutModule: topBySignal(allHotspots, "outgoingCoupling")?.path,
      largestSourceFile: topBySignal(allHotspots, "size")?.path,
      markerHeaviestFile: topBySignal(allHotspots, "markerDensity")?.path,
      filesInCycles: allHotspots.filter((hotspot) => hotspot.metrics.inCycle).length,
      recentlyActiveHotspots: allHotspots.filter((hotspot) => hotspot.metrics.recentTouchCount && hotspot.metrics.recentTouchCount > 0).length,
    },
    hotspots,
    categories: hotspotCategories(allHotspots),
    weights: hotspotWeights,
    limitations: [
      "Scores compare files within this repository only and are not comparable across repositories.",
      "Git churn counts file touches from available local history and does not reconstruct renames.",
      "Test awareness uses filename and path conventions; it does not prove behavioral coverage.",
      "Relationship centrality is based on supported static import patterns, not full compiler semantics.",
    ],
  };
}

export function emptyHotspotAnalysis(): HotspotAnalysis {
  return {
    summary: {
      filesAnalyzed: 0,
      hotspotsSurfaced: 0,
      filesInCycles: 0,
      recentlyActiveHotspots: 0,
    },
    hotspots: [],
    categories: hotspotCategories([]),
    weights: hotspotWeights,
    limitations: [],
  };
}

function isHotspotCandidate(file: FileInfo): boolean {
  if (file.isBinary || !file.isText || !file.isSource) {
    return false;
  }

  return hotspotSourceExtensions.has(path.posix.extname(file.path).toLowerCase());
}

function markerDensity(markerCount: number, lineCount: number | undefined): number {
  if (!lineCount || lineCount <= 0) {
    return markerCount > 0 ? markerCount : 0;
  }

  return roundSignal((markerCount / lineCount) * 100);
}

function isTestFile(filePath: string): boolean {
  return /(^|\/)(tests?|__tests__)\//i.test(filePath) || /(\.test|\.spec)\.[cm]?[jt]sx?$/i.test(filePath) || /(_test\.go|_test\.py)$/i.test(filePath);
}

function hasLikelyRelatedTest(filePath: string, testPaths: Set<string>): boolean {
  const extension = path.posix.extname(filePath);
  const basename = path.posix.basename(filePath, extension);
  const directory = path.posix.dirname(filePath);
  const normalizedBase = basename.replace(/\.(test|spec)$/i, "");

  for (const testPath of testPaths) {
    const testExtension = path.posix.extname(testPath);
    const testBase = path.posix.basename(testPath, testExtension).replace(/\.(test|spec)$/i, "").replace(/_test$/i, "");
    if (testBase !== normalizedBase) {
      continue;
    }

    if (testPath.startsWith(`${directory}/`) || testPath.includes(`/tests/`) || testPath.includes(`/__tests__/`)) {
      return true;
    }
  }

  return false;
}

function hotspotReasons(filePath: string, signals: HotspotSignals, metrics: HotspotMetrics): HotspotReason[] {
  const reasons: HotspotReason[] = [];
  addSignalReason(reasons, "churn", signals.churn, metrics.touchCount, `${filePath} is among the most frequently changed files.`);
  addSignalReason(reasons, "recent-activity", signals.recentActivity, metrics.recentTouchCount, `${filePath} has recent Git activity.`);
  addSignalReason(reasons, "incoming-centrality", signals.incomingCentrality, metrics.incomingCount, "Many supported modules depend on this file.");
  addSignalReason(reasons, "outgoing-coupling", signals.outgoingCoupling, metrics.outgoingCount, "This file depends on many supported local modules.");
  addSignalReason(reasons, "size", signals.size, metrics.lineCount ?? metrics.bytes, "This is one of the larger source files in the repository.");
  addSignalReason(reasons, "marker-density", signals.markerDensity, metrics.markerDensity, "TODO/FIXME/HACK/XXX markers are dense relative to file length.");
  addSignalReason(reasons, "contributor-spread", signals.contributorSpread, metrics.authorCount, "Several contributors have touched this file.");

  if (metrics.inCycle) {
    reasons.push({
      kind: "cycle-membership",
      severity: "high",
      message: "This file is part of a detected dependency cycle.",
      metric: 1,
      percentile: 1,
    });
  }

  if (signals.testAwareness > 0) {
    reasons.push({
      kind: "test-awareness",
      severity: "notable",
      message: "No obvious related test file was detected by naming conventions.",
      metric: 1,
      percentile: 1,
    });
  }

  return reasons.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.kind.localeCompare(b.kind));
}

function addSignalReason(
  reasons: HotspotReason[],
  kind: HotspotSignalKind,
  signal: number,
  metric: number | undefined,
  message: string,
): void {
  const severity = severityForSignal(signal);
  if (!severity) {
    return;
  }

  reasons.push({
    kind,
    severity,
    message,
    metric,
    percentile: signal,
  });
}

function topBySignal(hotspots: FileHotspot[], signal: keyof HotspotSignals): FileHotspot | undefined {
  return hotspots.filter((hotspot) => hotspot.signals[signal] > 0).sort((a, b) => b.signals[signal] - a.signals[signal] || b.score - a.score || a.path.localeCompare(b.path))[0];
}

function hotspotCategories(hotspots: FileHotspot[]): HotspotCategory[] {
  return [
    category("churn", "High churn", hotspots, (hotspot) => hotspot.signals.churn),
    category("incoming-centrality", "Structurally central", hotspots, (hotspot) => hotspot.signals.incomingCentrality),
    category("outgoing-coupling", "High fan-out", hotspots, (hotspot) => hotspot.signals.outgoingCoupling),
    category("size", "Large modules", hotspots, (hotspot) => hotspot.signals.size),
    category("marker-density", "Marker-heavy", hotspots, (hotspot) => hotspot.signals.markerDensity),
    category("cycle-membership", "Cyclic", hotspots, (hotspot) => hotspot.signals.cycleMembership),
    category("recent-activity", "Recently active", hotspots, (hotspot) => hotspot.signals.recentActivity),
  ];
}

function category(id: HotspotSignalKind, label: string, hotspots: FileHotspot[], signal: (hotspot: FileHotspot) => number): HotspotCategory {
  return {
    id,
    label,
    hotspots: hotspots
      .filter((hotspot) => signal(hotspot) >= 0.5)
      .sort((a, b) => signal(b) - signal(a) || b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, maxCategoryHotspots),
  };
}

function severityRank(severity: HotspotReason["severity"]): number {
  if (severity === "high") {
    return 3;
  }

  if (severity === "elevated") {
    return 2;
  }

  return 1;
}
