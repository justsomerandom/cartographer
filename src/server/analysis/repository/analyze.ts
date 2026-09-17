import path from "node:path";

import type { GitSummary, MarkerSummary, ProjectMetadata, RepositoryAnalysis } from "../../../types/repository";
import { analyzeDependencies, emptyDependencyAnalysis } from "./dependencies/analyze";
import { scanRepository, validateRepositoryPath } from "./files";
import { gitErrorSummary, analyzeGit } from "./git";
import { analyzeHotspots, emptyHotspotAnalysis } from "./hotspots/analyze";
import { detectProjectMetadata } from "./metadata";
import { analyzeSourceRelationships, emptySourceRelationshipAnalysis } from "./relationships/analyze";
import { summarizeLanguages } from "./scan";

export async function analyzeRepository(inputPath: string): Promise<RepositoryAnalysis> {
  const validation = await validateRepositoryPath(inputPath);

  if (!validation.ok) {
    return emptyAnalysis(inputPath, [validation.error]);
  }

  const { canonicalPath, absolutePath } = validation.value;
  const scan = await scanRepository(canonicalPath);
  const gitPromise = analyzeGit(canonicalPath).catch(gitErrorSummary);
  const dependencyAnalysisPromise = analyzeDependencies(canonicalPath, scan.files);

  const [git, dependencyAnalysis] = await Promise.all([gitPromise, dependencyAnalysisPromise]);
  const sourceRelationships = await analyzeSourceRelationships(canonicalPath, scan.files, dependencyAnalysis);
  const hotspotAnalysis = analyzeHotspots({
    files: scan.files,
    git,
    markers: scan.markers,
    sourceRelationships,
    dependencyAnalysis,
  });
  const metadata = detectProjectMetadata(scan.files, scan.directories);

  return {
    info: {
      inputPath,
      absolutePath,
      canonicalPath,
      name: path.basename(canonicalPath),
      analyzedAt: new Date().toISOString(),
    },
    files: scan.summary,
    fileDetails: scan.files,
    languages: summarizeLanguages(scan.files),
    git,
    metadata,
    dependencyAnalysis,
    sourceRelationships,
    hotspotAnalysis,
    markers: scan.markers,
    errors: [...scan.errors, ...git.errors],
  };
}

function emptyAnalysis(inputPath: string, errors = [] as RepositoryAnalysis["errors"]): RepositoryAnalysis {
  return {
    info: {
      inputPath,
      analyzedAt: new Date().toISOString(),
    },
    files: {
      totalFiles: 0,
      sourceFiles: 0,
      textFiles: 0,
      binaryFiles: 0,
      directoryCount: 0,
      totalBytes: 0,
      approximateLineCount: 0,
      largestFiles: [],
    },
    fileDetails: [],
    languages: [],
    git: emptyGitSummary(),
    metadata: emptyMetadata(),
    dependencyAnalysis: emptyDependencyAnalysis(),
    sourceRelationships: emptySourceRelationshipAnalysis(),
    hotspotAnalysis: emptyHotspotAnalysis(),
    markers: emptyMarkers(),
    errors,
  };
}

function emptyGitSummary(): GitSummary {
  return {
    availability: "not-repository",
    isRepository: false,
    detachedHead: false,
    dirty: false,
    contributors: [],
    recentCommits: [],
    hotFiles: [],
    fileHistory: [],
    errors: [],
  };
}

function emptyMetadata(): ProjectMetadata {
  return {
    readmes: [],
    manifests: [],
    containers: [],
    ci: [],
    tests: [],
    environmentExamples: [],
    licenses: [],
  };
}

function emptyMarkers(): MarkerSummary {
  return {
    total: 0,
    byType: {
      TODO: 0,
      FIXME: 0,
      HACK: 0,
      XXX: 0,
    },
    files: [],
    topFiles: [],
  };
}
