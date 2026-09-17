import type { ReactNode } from "react";

import type { DependencyAnalysis, DetectedMetadataItem, FileHotspot, HotspotAnalysis, RepositoryAnalysis, SourceRelationshipAnalysis } from "@/types/repository";
import { DataTable, DetailPanel, EmptyState, KeyValue, MetricGroup, Panel, SectionHeader, SignalBar, StatusBadge, Toolbar, VisualizationPanel } from "./ui";

export function ProjectsHome({ savedCount }: { savedCount: number }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace"
        title={savedCount === 0 ? "Open a repository to begin mapping it." : "Choose a saved repository."}
        description="Cartographer analyzes local repositories from a read-only server boundary and keeps saved projects as local path references."
      />
      <Panel title="Repository access" description="Use the sidebar to open an absolute path or a path relative to the Cartographer process.">
        <EmptyState title={savedCount === 0 ? "No saved projects" : "Choose a saved project"}>
          {savedCount === 0
            ? "Analyze a repository to create your first saved project. Cartographer will not modify the repository."
            : "Select a saved project from the sidebar to open a route-addressable repository view."}
        </EmptyState>
      </Panel>
    </div>
  );
}

export function MissingProjectView({ path }: { path: string }) {
  return (
    <Panel title="Repository unavailable" description="The saved project record still exists, but the repository path cannot be analyzed right now." emphasis="strong">
      <div className="space-y-3">
        <StatusBadge tone="danger">Missing or inaccessible</StatusBadge>
        <p className="break-words font-mono text-sm text-[var(--color-text)]">{path}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">Retry after restoring the path, open another repository, or remove this saved project from the header.</p>
      </div>
    </Panel>
  );
}

export function OverviewSection({ analysis }: { analysis: RepositoryAnalysis }) {
  const topHotspot = analysis.hotspotAnalysis.hotspots[0];
  const unresolvedCount = analysis.sourceRelationships.summary.unresolvedImportCount;
  const cycleCount = analysis.sourceRelationships.summary.cyclicGroupCount;
  const noticeCount = analysis.errors.length + analysis.dependencyAnalysis.errors.length + analysis.sourceRelationships.errors.length;
  const primaryLanguages = analysis.languages.slice(0, 4).map((language) => `${language.language} ${language.percentage.toFixed(1)}%`).join(", ") || "No source languages";

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Overview"
        title="Repository state and engineering attention"
        description="A compact read of the repository's composition, structural signals, Git state, and highest-value follow-up areas."
      />

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Engineering attention" description="Signals here are prioritized because they can change where an engineer should look first." emphasis="strong">
          <div className="grid gap-4 lg:grid-cols-3">
            <AttentionItem
              label="Top hotspot"
              value={topHotspot ? topHotspot.path : "Unavailable"}
              detail={topHotspot ? `Score ${topHotspot.score}; ${topHotspot.reasons[0]?.message ?? "multiple repository-relative signals"}` : "No source hotspots were identified."}
              tone={topHotspot ? "attention" : "neutral"}
            />
            <AttentionItem
              label="Architecture"
              value={`${cycleCount.toLocaleString()} cycles`}
              detail={`${unresolvedCount.toLocaleString()} unresolved local imports`}
              tone={cycleCount > 0 || unresolvedCount > 0 ? "attention" : "success"}
            />
            <AttentionItem
              label="Repository health"
              value={analysis.git.isRepository ? (analysis.git.dirty ? "Modified" : "Clean") : analysis.git.availability}
              detail={`${noticeCount.toLocaleString()} analysis notices`}
              tone={analysis.git.dirty || noticeCount > 0 ? "attention" : "success"}
            />
          </div>
        </Panel>

        <Panel title="Repository context" description="Routine metadata is kept compact so attention signals remain dominant.">
          <div className="space-y-2">
            <KeyValue label="Languages" value={primaryLanguages} />
            <KeyValue label="Technologies" value={analysis.dependencyAnalysis.summary.technologies.map((technology) => technology.name).slice(0, 8).join(", ") || "None detected"} />
            <KeyValue label="Branch" value={<span className="font-mono">{analysis.git.branch ?? (analysis.git.detachedHead ? "detached HEAD" : "unavailable")}</span>} />
            <KeyValue label="Latest commit" value={analysis.git.latestCommitMessage ?? "Unavailable"} />
          </div>
        </Panel>
      </section>

      <MetricGroup
        metrics={[
          { label: "Source files", value: analysis.files.sourceFiles.toLocaleString(), primary: true },
          { label: "Lines", value: analysis.files.approximateLineCount.toLocaleString() },
          { label: "Projects", value: analysis.dependencyAnalysis.summary.projectCount.toLocaleString() },
          { label: "Direct deps", value: analysis.dependencyAnalysis.summary.totalDirectDependencies.toLocaleString() },
          { label: "Internal edges", value: analysis.sourceRelationships.summary.internalRelationshipCount.toLocaleString() },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Question: What is this repository made of? Visualization: language/technology composition. Data: RepositoryAnalysis.languages and dependencyAnalysis.summary. */}
        <VisualizationPanel
          title="Repository composition"
          description="Reserved for a compact language and technology composition view using stable visualization category colors."
          height="small"
          legend={<span>Current summary: {primaryLanguages}</span>}
        >
          Composition visualization planned for languages and detected technologies.
        </VisualizationPanel>
        {/* Question: How active is this repository? Visualization: commit/churn sparkline. Data: GitSummary recent commits and file history. */}
        <VisualizationPanel
          title="Engineering activity"
          description="Reserved for a time-oriented activity view that distinguishes commits, churn, and contributor activity."
          height="small"
          legend={<span>Current summary: {analysis.git.totalCommits?.toLocaleString() ?? "unknown"} commits in available history.</span>}
        >
          Activity visualization planned for Git history and file churn.
        </VisualizationPanel>
        {/* Question: How connected is the codebase? Visualization: compact module relationship overview. Data: SourceRelationshipAnalysis. */}
        <VisualizationPanel
          title="Architecture"
          description="Reserved for a structural overview of modules, edges, cycles, and unresolved local imports."
          height="small"
          legend={<span>{analysis.sourceRelationships.summary.sourceModulesAnalyzed.toLocaleString()} modules analyzed.</span>}
        >
          Architecture visualization planned for source relationships.
        </VisualizationPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Recent Git context">
          <DataTable
            headers={["Commit", "Author", "Timestamp"]}
            rows={analysis.git.recentCommits.slice(0, 5).map((commit) => [`${commit.shortHash} ${commit.subject}`, commit.author, commit.timestamp])}
            emptyText="No recent commits found."
          />
        </Panel>
        <Panel title="Detected projects">
          <DataTable
            headers={["Project", "Ecosystem", "Dependencies"]}
            rows={analysis.dependencyAnalysis.projects.slice(0, 6).map((project) => [project.name ?? (project.rootPath || project.manifestPath), project.ecosystem, project.dependencies.length.toLocaleString()])}
            numericColumns={[2]}
            emptyText="No supported dependency manifests were found."
          />
        </Panel>
      </div>
    </div>
  );
}

export function FilesSection({ analysis }: { analysis: RepositoryAnalysis }) {
  const markerByPath = new Map(analysis.markers.topFiles.map((entry) => [entry.path, entry.count]));
  const rows = [...analysis.fileDetails]
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))
    .slice(0, 250)
    .map((file) => [
      <span key="path" className="font-mono text-xs">
        {file.path}
      </span>,
      file.language ?? "Unknown",
      formatBytes(file.bytes),
      (file.lineCount ?? 0).toLocaleString(),
      (markerByPath.get(file.path) ?? 0).toLocaleString(),
    ]);

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Files" title="File inventory and source footprint" description="Largest scanned files with source-language, size, line, and marker context." />
      <MetricGroup
        metrics={[
          { label: "Total files", value: analysis.files.totalFiles.toLocaleString(), primary: true },
          { label: "Source", value: analysis.files.sourceFiles.toLocaleString() },
          { label: "Text", value: analysis.files.textFiles.toLocaleString() },
          { label: "Binary", value: analysis.files.binaryFiles.toLocaleString() },
          { label: "Bytes", value: formatBytes(analysis.files.totalBytes) },
        ]}
      />
      <Panel title="Largest scanned files" description="Build, dependency, cache, IDE, and Git directories are ignored.">
        <DataTable headers={["Path", "Language", "Size", "Lines", "Markers"]} rows={rows} numericColumns={[2, 3, 4]} emptyText="No files were found for this repository." />
      </Panel>
    </div>
  );
}

export function DependenciesSection({ dependencyAnalysis }: { dependencyAnalysis: DependencyAnalysis }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Dependencies"
        title="Declared projects and package surface"
        description="Manifest-level dependency intelligence only; Cartographer does not install packages or resolve registry data."
      />
      <MetricGroup
        metrics={[
          { label: "Projects", value: dependencyAnalysis.summary.projectCount.toLocaleString(), primary: true },
          { label: "Direct deps", value: dependencyAnalysis.summary.totalDirectDependencies.toLocaleString() },
          { label: "Runtime", value: dependencyAnalysis.summary.runtimeDependencyCount.toLocaleString() },
          { label: "Development", value: dependencyAnalysis.summary.developmentDependencyCount.toLocaleString() },
          { label: "Differing", value: dependencyAnalysis.summary.differingDeclaredVersions.length.toLocaleString(), tone: dependencyAnalysis.summary.differingDeclaredVersions.length > 0 ? "attention" : "neutral" },
        ]}
      />

      {/* Question: How are projects and dependencies arranged? Visualization: dependency/workspace map. Data: DependencyAnalysis.projects and dependencies. */}
      <VisualizationPanel
        title="Dependency and workspace map"
        description="Reserved for a project-to-dependency map with ecosystems, workspace boundaries, and repeated declarations."
        controls={<Toolbar><StatusBadge tone="info">Map planned</StatusBadge></Toolbar>}
      >
        Future map will use detected manifests, workspace roots, dependency categories, and repeated dependency declarations.
      </VisualizationPanel>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Detected projects">
          <DataTable
            headers={["Project", "Ecosystem", "Manifest", "Dependencies", "Technologies"]}
            rows={dependencyAnalysis.projects.map((project) => [
              project.name ?? (project.rootPath || project.manifestPath),
              <StatusBadge key="ecosystem" tone="info">{project.ecosystem}</StatusBadge>,
              <span key="manifest" className="font-mono text-xs">{project.manifestPath}</span>,
              project.dependencies.length.toLocaleString(),
              project.technologies.map((technology) => technology.name).join(", ") || "None",
            ])}
            numericColumns={[3]}
            emptyText="No supported dependency manifests were found."
          />
        </Panel>
        <Panel title="Dependency declarations">
          <DataTable
            headers={["Name", "Version", "Category", "Ecosystem", "Manifest"]}
            rows={dependencyAnalysis.projects
              .flatMap((project) => project.dependencies)
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice(0, 400)
              .map((dependency) => [
                dependency.name,
                dependency.version ?? dependency.path ?? dependency.git ?? "Unspecified",
                dependency.category,
                dependency.ecosystem,
                <span key="manifest" className="font-mono text-xs">{dependency.manifestPath}</span>,
              ])}
            emptyText="No direct dependencies were declared."
          />
        </Panel>
      </div>
    </div>
  );
}

export function RelationshipsSection({ sourceRelationships }: { sourceRelationships: SourceRelationshipAnalysis }) {
  const selected = sourceRelationships.summary.highestFanOut[0]?.path ?? sourceRelationships.modules[0]?.path;
  const dependencies = sourceRelationships.relationships.filter((relationship) => relationship.status === "internal" && relationship.sourcePath === selected);
  const dependents = sourceRelationships.relationships.filter((relationship) => relationship.status === "internal" && relationship.targetPath === selected);
  const external = sourceRelationships.unresolvedImports.filter((entry) => entry.sourcePath === selected && entry.status === "external");
  const unresolved = sourceRelationships.unresolvedImports.filter((entry) => entry.sourcePath === selected && entry.status !== "external");

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Relationships"
        title="Source architecture and module connections"
        description="A graph-first page structure for supported static imports, with tables retained as evidence and detail."
      />
      <MetricGroup
        metrics={[
          { label: "Modules", value: sourceRelationships.summary.sourceModulesAnalyzed.toLocaleString(), primary: true },
          { label: "Internal edges", value: sourceRelationships.summary.internalRelationshipCount.toLocaleString() },
          { label: "External imports", value: sourceRelationships.summary.externalImportCount.toLocaleString() },
          { label: "Unresolved", value: sourceRelationships.summary.unresolvedImportCount.toLocaleString(), tone: sourceRelationships.summary.unresolvedImportCount > 0 ? "attention" : "neutral" },
          { label: "Cycles", value: sourceRelationships.summary.cyclicGroupCount.toLocaleString(), tone: sourceRelationships.summary.cyclicGroupCount > 0 ? "attention" : "neutral" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        {/* Question: How is this project structurally connected? Visualization: interactive network graph. Data: SourceRelationshipAnalysis.relationships, modules, cycles. */}
        <VisualizationPanel
          title="Architecture graph"
          description="Reserved for an interactive module graph with pan, zoom, search, filters, neighbor highlighting, and selected-node details."
          height="large"
          legend={<span>Nodes: source modules. Edges: resolved internal imports. Cycle membership and unresolved imports will be encoded separately from semantic errors.</span>}
        >
          Graph canvas planned for supported source relationships.
        </VisualizationPanel>
        <DetailPanel title="Selected module">
          {selected ? (
            <div className="space-y-2">
              <KeyValue label="Path" value={<span className="font-mono text-xs">{selected}</span>} />
              <KeyValue label="Depends on" value={dependencies.length.toLocaleString()} />
              <KeyValue label="Depended on by" value={dependents.length.toLocaleString()} />
              <KeyValue label="External imports" value={external.length.toLocaleString()} />
              <KeyValue label="Unresolved" value={unresolved.length.toLocaleString()} />
            </div>
          ) : (
            <EmptyState title="No supported source files">Supported source files include TypeScript, JavaScript, Rust, Go, and Python.</EmptyState>
          )}
        </DetailPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Most depended-on">
          <DataTable headers={["Module", "Incoming"]} rows={sourceRelationships.summary.mostDependedOn.map((module) => [<span key="path" className="font-mono text-xs">{module.path}</span>, module.count.toLocaleString()])} numericColumns={[1]} emptyText="No incoming internal relationships found." />
        </Panel>
        <Panel title="Highest fan-out">
          <DataTable headers={["Module", "Outgoing"]} rows={sourceRelationships.summary.highestFanOut.map((module) => [<span key="path" className="font-mono text-xs">{module.path}</span>, module.count.toLocaleString()])} numericColumns={[1]} emptyText="No outgoing internal relationships found." />
        </Panel>
      </div>
      <Panel title="Cycles and unresolved imports">
        <div className="grid gap-4 xl:grid-cols-2">
          <DataTable headers={["Cyclic group"]} rows={sourceRelationships.cycles.map((cycle) => [cycle.modules.join(" -> ")])} emptyText="No dependency cycles detected." />
          <DataTable headers={["Import", "Reason"]} rows={sourceRelationships.unresolvedImports.filter((entry) => entry.status !== "external").map((entry) => [entry.importText, entry.reason])} emptyText="No unresolved local-looking imports detected." />
        </div>
      </Panel>
    </div>
  );
}

export function HotspotsSection({ hotspotAnalysis }: { hotspotAnalysis: HotspotAnalysis }) {
  const topHotspot = hotspotAnalysis.hotspots[0];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Hotspots"
        title="Files that deserve investigation and why"
        description="Hotspot scores combine repository-relative Git, structure, marker, size, cycle, contributor, and test-awareness signals."
      />
      <MetricGroup
        metrics={[
          { label: "Files analyzed", value: hotspotAnalysis.summary.filesAnalyzed.toLocaleString(), primary: true },
          { label: "Hotspots", value: hotspotAnalysis.summary.hotspotsSurfaced.toLocaleString(), tone: hotspotAnalysis.summary.hotspotsSurfaced > 0 ? "attention" : "neutral" },
          { label: "In cycles", value: hotspotAnalysis.summary.filesInCycles.toLocaleString(), tone: hotspotAnalysis.summary.filesInCycles > 0 ? "attention" : "neutral" },
          { label: "Recently active", value: hotspotAnalysis.summary.recentlyActiveHotspots.toLocaleString() },
          { label: "Top score", value: topHotspot?.score.toLocaleString() ?? "0" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        {/* Question: Which files combine high churn and high structural importance? Visualization: scatter plot. Data: HotspotAnalysis.hotspots, signals, metrics. */}
        <VisualizationPanel
          title="Churn vs centrality"
          description="Reserved for a scatter plot: X is churn percentile, Y is dependency centrality, point size is source size, and overlays identify cycles or marker density."
          height="standard"
          legend={<span>Hotspot importance is an attention signal, not an error state.</span>}
        >
          Scatter visualization planned for hotspot signals.
        </VisualizationPanel>
        <DetailPanel title="Top hotspot">
          {topHotspot ? (
            <div className="space-y-3">
              <KeyValue label="Path" value={<span className="font-mono text-xs">{topHotspot.path}</span>} />
              <KeyValue label="Score" value={<StatusBadge tone={hotspotTone(topHotspot)}>{topHotspot.score}</StatusBadge>} />
              <KeyValue label="Main reason" value={topHotspot.reasons[0]?.message ?? "Repository-relative signals are elevated."} />
              <KeyValue label="Lines" value={topHotspot.metrics.lineCount?.toLocaleString() ?? "Unknown"} />
            </div>
          ) : (
            <EmptyState title="No hotspots">No source hotspots were identified.</EmptyState>
          )}
        </DetailPanel>
      </div>

      <Panel title="Ranked hotspots" description="Scores are repository-relative and expose their strongest component signals.">
        <DataTable
          headers={["Rank", "Path", "Score", "Churn", "Centrality", "Reasons"]}
          rows={hotspotAnalysis.hotspots.map((hotspot) => [
            hotspot.rank.toLocaleString(),
            <span key="path" className="font-mono text-xs">{hotspot.path}</span>,
            <StatusBadge key="score" tone={hotspotTone(hotspot)}>{hotspot.score}</StatusBadge>,
            <SignalBar key="churn" value={hotspot.signals.churn} tone="info" />,
            <SignalBar key="centrality" value={hotspot.signals.incomingCentrality} tone="success" />,
            hotspot.reasons.map((reason) => reason.message).slice(0, 3).join(" "),
          ])}
          numericColumns={[0, 2]}
          selectedRowIndex={0}
          emptyText="No source hotspots were identified."
        />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        {hotspotAnalysis.categories.map((category) => (
          <Panel key={category.id} title={category.label}>
            <DataTable
              headers={["Path", "Score"]}
              rows={category.hotspots.map((hotspot) => [<span key="path" className="font-mono text-xs">{hotspot.path}</span>, hotspot.score.toLocaleString()])}
              numericColumns={[1]}
              emptyText={`No ${category.label.toLowerCase()} files found.`}
            />
          </Panel>
        ))}
      </div>
      <Panel title="Model limitations">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
          {hotspotAnalysis.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function GitSection({ analysis }: { analysis: RepositoryAnalysis }) {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Git" title="History, working tree, and churn context" description="Local Git CLI data only; repository history is read without modifying the working tree." />
      <MetricGroup
        metrics={[
          { label: "Availability", value: analysis.git.availability, primary: true },
          { label: "Commits", value: analysis.git.totalCommits?.toLocaleString() ?? "Unknown" },
          { label: "Contributors", value: analysis.git.contributors.length.toLocaleString() },
          { label: "Changed files", value: analysis.git.fileHistory.length.toLocaleString() },
          { label: "Working tree", value: analysis.git.dirty ? "Modified" : "Clean", tone: analysis.git.dirty ? "attention" : "success" },
        ]}
      />

      {/* Question: How has work changed over time? Visualization: time-series chart. Data: GitSummary.recentCommits and fileHistory. */}
      <VisualizationPanel
        title="Commit and churn timeline"
        description="Reserved for a wide time-series visualization of commits, file touches, and contributor activity."
        height="standard"
        legend={<span>Time-series charts need horizontal room, so this region intentionally spans the page.</span>}
      >
        Timeline visualization planned for Git activity and churn history.
      </VisualizationPanel>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="Recent commits">
          <DataTable headers={["Commit", "Author", "Timestamp"]} rows={analysis.git.recentCommits.map((commit) => [`${commit.shortHash} ${commit.subject}`, commit.author, commit.timestamp])} emptyText="No recent commits found." />
        </Panel>
        <Panel title="Git summary">
          <div className="space-y-2">
            <KeyValue label="Branch" value={<span className="font-mono">{analysis.git.branch ?? (analysis.git.detachedHead ? "Detached HEAD" : "Unavailable")}</span>} />
            <KeyValue label="Dirty" value={analysis.git.dirty ? "Modified" : "Clean"} />
            <KeyValue label="Head" value={analysis.git.headCommit ? <span className="font-mono text-xs">{analysis.git.headCommit}</span> : "Unavailable"} />
            <KeyValue label="Latest" value={analysis.git.latestCommitMessage ?? "Unavailable"} />
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Contributors">
          <DataTable headers={["Name", "Commits"]} rows={analysis.git.contributors.map((contributor) => [contributor.name, contributor.commitCount.toLocaleString()])} numericColumns={[1]} emptyText="No contributors found." />
        </Panel>
        <Panel title="Most changed files">
          <DataTable headers={["Path", "Touches"]} rows={analysis.git.hotFiles.map((file) => [<span key="path" className="font-mono text-xs">{file.path}</span>, file.changeCount.toLocaleString()])} numericColumns={[1]} emptyText="No file churn data found." />
        </Panel>
      </div>
    </div>
  );
}

export function ProjectSection({ metadata }: { metadata: RepositoryAnalysis["metadata"] }) {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Project" title="Repository metadata signals" description="Detected project files, operational metadata, and common repository affordances." />
      <div className="grid gap-4 xl:grid-cols-2">
        <MetadataPanel title="README" items={metadata.readmes} />
        <MetadataPanel title="Manifests" items={metadata.manifests} />
        <MetadataPanel title="Docker" items={metadata.containers} />
        <MetadataPanel title="CI" items={metadata.ci} />
        <MetadataPanel title="Tests" items={metadata.tests} />
        <MetadataPanel title="Licenses" items={metadata.licenses} />
        <MetadataPanel title="Environment examples" items={metadata.environmentExamples} />
      </div>
    </div>
  );
}

function AttentionItem({ label, value, detail, tone }: { label: string; value: ReactNode; detail: ReactNode; tone: "neutral" | "attention" | "success" }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{label}</div>
        <StatusBadge tone={tone}>{tone === "success" ? "steady" : tone}</StatusBadge>
      </div>
      <div className="mt-2 break-words text-lg font-semibold text-[var(--color-text)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{detail}</div>
    </div>
  );
}

function MetadataPanel({ title, items }: { title: string; items: DetectedMetadataItem[] }) {
  return (
    <Panel title={title}>
      <DataTable headers={["Type", "Path"]} rows={items.map((item) => [item.label, <span key="path" className="font-mono text-xs">{item.path}</span>])} emptyText={`No ${title.toLowerCase()} detected.`} />
    </Panel>
  );
}

function hotspotTone(hotspot: FileHotspot): "neutral" | "attention" | "danger" {
  if (hotspot.severity === "high") {
    return "attention";
  }

  if (hotspot.severity === "elevated") {
    return "attention";
  }

  return "neutral";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
