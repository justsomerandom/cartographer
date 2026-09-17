import type { DependencyAnalysis, DetectedMetadataItem, RepositoryAnalysis, SourceRelationshipAnalysis } from "@/types/repository";
import { DataTable, EmptyState, KeyValue, MetricStrip, Panel, StatusBadge } from "./ui";

export function ProjectsHome({ savedCount }: { savedCount: number }) {
  return (
    <Panel title="Open a repository" description="Enter a local path in the sidebar to analyze and save it. Saved projects are local path references only.">
      <EmptyState title={savedCount === 0 ? "No saved projects" : "Choose a saved project"}>
        {savedCount === 0
          ? "Analyze a repository to create your first saved project. Cartographer will not modify the repository."
          : "Select a saved project from the sidebar to open a route-addressable repository view."}
      </EmptyState>
    </Panel>
  );
}

export function MissingProjectView({ path }: { path: string }) {
  return (
    <Panel title="Repository unavailable" description="The saved project record still exists, but the repository path cannot be analyzed right now.">
      <div className="space-y-3">
        <StatusBadge tone="attention">Missing or inaccessible</StatusBadge>
        <p className="break-words text-sm text-slate-700">{path}</p>
        <p className="text-sm text-slate-600">Retry after restoring the path, open another repository, or remove this saved project from the header.</p>
      </div>
    </Panel>
  );
}

export function OverviewSection({ analysis }: { analysis: RepositoryAnalysis }) {
  const primaryLanguages = analysis.languages.slice(0, 4).map((language) => `${language.language} ${language.percentage.toFixed(1)}%`).join(", ") || "No source languages";
  const hotFile = analysis.git.hotFiles[0];

  return (
    <div className="space-y-5">
      <MetricStrip
        metrics={[
          { label: "Source files", value: analysis.files.sourceFiles.toLocaleString() },
          { label: "Lines", value: analysis.files.approximateLineCount.toLocaleString() },
          { label: "Projects", value: analysis.dependencyAnalysis.summary.projectCount.toLocaleString() },
          {
            label: "Cycles",
            value: analysis.sourceRelationships.summary.cyclicGroupCount.toLocaleString(),
            tone: analysis.sourceRelationships.summary.cyclicGroupCount > 0 ? "attention" : "neutral",
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Repository context">
          <div className="space-y-2">
            <KeyValue label="Git" value={analysis.git.isRepository ? `${analysis.git.branch ?? "detached"} / ${analysis.git.dirty ? "modified" : "clean"}` : analysis.git.availability} />
            <KeyValue label="Languages" value={primaryLanguages} />
            <KeyValue label="Technologies" value={analysis.dependencyAnalysis.summary.technologies.map((technology) => technology.name).slice(0, 8).join(", ") || "None detected"} />
            <KeyValue label="Latest commit" value={analysis.git.latestCommitMessage ?? "Unavailable"} />
          </div>
        </Panel>
        <Panel title="Where to look next">
          <div className="space-y-2">
            <KeyValue label="Unresolved imports" value={attentionText(analysis.sourceRelationships.summary.unresolvedImportCount)} />
            <KeyValue label="TODO/FIXME" value={(analysis.markers.byType.TODO + analysis.markers.byType.FIXME).toLocaleString()} />
            <KeyValue label="Hot file" value={hotFile ? `${hotFile.path} (${hotFile.changeCount})` : "Unavailable"} />
            <KeyValue label="Analysis notices" value={(analysis.errors.length + analysis.dependencyAnalysis.errors.length + analysis.sourceRelationships.errors.length).toLocaleString()} />
          </div>
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
    .map((file) => [file.path, file.language ?? "Unknown", formatBytes(file.bytes), (file.lineCount ?? 0).toLocaleString(), (markerByPath.get(file.path) ?? 0).toLocaleString()]);

  return (
    <Panel title="Files" description="Largest 250 scanned files. Build, dependency, and cache directories are ignored.">
      <DataTable headers={["Path", "Language", "Size", "Lines", "Markers"]} rows={rows} emptyText="No files were found for this repository." />
    </Panel>
  );
}

export function DependenciesSection({ dependencyAnalysis }: { dependencyAnalysis: DependencyAnalysis }) {
  return (
    <div className="space-y-5">
      <MetricStrip
        metrics={[
          { label: "Projects", value: dependencyAnalysis.summary.projectCount.toLocaleString() },
          { label: "Direct deps", value: dependencyAnalysis.summary.totalDirectDependencies.toLocaleString() },
          { label: "Repeated", value: dependencyAnalysis.summary.repeatedDependencies.length.toLocaleString() },
          { label: "Differing", value: dependencyAnalysis.summary.differingDeclaredVersions.length.toLocaleString(), tone: dependencyAnalysis.summary.differingDeclaredVersions.length > 0 ? "attention" : "neutral" },
        ]}
      />
      <Panel title="Detected projects">
        <DataTable
          headers={["Project", "Ecosystem", "Manifest", "Dependencies", "Technologies"]}
          rows={dependencyAnalysis.projects.map((project) => [
            project.name ?? (project.rootPath || project.manifestPath),
            project.ecosystem,
            project.manifestPath,
            project.dependencies.length.toLocaleString(),
            project.technologies.map((technology) => technology.name).join(", ") || "None",
          ])}
          emptyText="No supported dependency manifests were found."
        />
      </Panel>
      <Panel title="Dependencies">
        <DataTable
          headers={["Name", "Version", "Category", "Ecosystem", "Manifest"]}
          rows={dependencyAnalysis.projects
            .flatMap((project) => project.dependencies)
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 400)
            .map((dependency) => [dependency.name, dependency.version ?? dependency.path ?? dependency.git ?? "Unspecified", dependency.category, dependency.ecosystem, dependency.manifestPath])}
          emptyText="No direct dependencies were declared."
        />
      </Panel>
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
    <div className="space-y-5">
      <MetricStrip
        metrics={[
          { label: "Modules", value: sourceRelationships.summary.sourceModulesAnalyzed.toLocaleString() },
          { label: "Internal edges", value: sourceRelationships.summary.internalRelationshipCount.toLocaleString() },
          { label: "External imports", value: sourceRelationships.summary.externalImportCount.toLocaleString() },
          { label: "Cycles", value: sourceRelationships.summary.cyclicGroupCount.toLocaleString(), tone: sourceRelationships.summary.cyclicGroupCount > 0 ? "attention" : "neutral" },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Most depended-on">
          <DataTable headers={["Module", "Incoming"]} rows={sourceRelationships.summary.mostDependedOn.map((module) => [module.path, module.count.toLocaleString()])} emptyText="No incoming internal relationships found." />
        </Panel>
        <Panel title="Highest fan-out">
          <DataTable headers={["Module", "Outgoing"]} rows={sourceRelationships.summary.highestFanOut.map((module) => [module.path, module.count.toLocaleString()])} emptyText="No outgoing internal relationships found." />
        </Panel>
      </div>
      <Panel title="Module detail" description={selected ? `Selected: ${selected}` : "No supported source module selected."}>
        {selected ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <DataTable headers={["Depends on"]} rows={dependencies.map((relationship) => [relationship.targetPath ?? "Unknown"])} emptyText="This module has no resolved internal dependencies." />
            <DataTable headers={["Depended on by"]} rows={dependents.map((relationship) => [relationship.sourcePath])} emptyText="No modules depend on this module." />
            <DataTable headers={["External import"]} rows={external.map((entry) => [entry.importText])} emptyText="No external imports for this module." />
            <DataTable headers={["Unresolved import", "Reason"]} rows={unresolved.map((entry) => [entry.importText, entry.reason])} emptyText="No unresolved imports for this module." />
          </div>
        ) : (
          <EmptyState title="No supported source files">Supported source files include TypeScript, JavaScript, Rust, Go, and Python.</EmptyState>
        )}
      </Panel>
      <Panel title="Cycles">
        <DataTable headers={["Cyclic group"]} rows={sourceRelationships.cycles.map((cycle) => [cycle.modules.join(" -> ")])} emptyText="No dependency cycles detected." />
      </Panel>
    </div>
  );
}

export function GitSection({ analysis }: { analysis: RepositoryAnalysis }) {
  return (
    <div className="space-y-5">
      <Panel title="Git summary">
        <div className="space-y-2">
          <KeyValue label="Availability" value={analysis.git.availability} />
          <KeyValue label="Branch" value={analysis.git.branch ?? (analysis.git.detachedHead ? "Detached HEAD" : "Unavailable")} />
          <KeyValue label="Dirty" value={analysis.git.dirty ? "Modified" : "Clean"} />
          <KeyValue label="Commits" value={analysis.git.totalCommits?.toLocaleString() ?? "Unavailable"} />
        </div>
      </Panel>
      <Panel title="Recent commits">
        <DataTable headers={["Commit", "Author", "Timestamp"]} rows={analysis.git.recentCommits.map((commit) => [`${commit.shortHash} ${commit.subject}`, commit.author, commit.timestamp])} emptyText="No recent commits found." />
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Contributors">
          <DataTable headers={["Name", "Commits"]} rows={analysis.git.contributors.map((contributor) => [contributor.name, contributor.commitCount.toLocaleString()])} emptyText="No contributors found." />
        </Panel>
        <Panel title="Most changed files">
          <DataTable headers={["Path", "Changes"]} rows={analysis.git.hotFiles.map((file) => [file.path, file.changeCount.toLocaleString()])} emptyText="No file churn data found." />
        </Panel>
      </div>
    </div>
  );
}

export function ProjectSection({ metadata }: { metadata: RepositoryAnalysis["metadata"] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <MetadataPanel title="README" items={metadata.readmes} />
      <MetadataPanel title="Manifests" items={metadata.manifests} />
      <MetadataPanel title="Docker" items={metadata.containers} />
      <MetadataPanel title="CI" items={metadata.ci} />
      <MetadataPanel title="Tests" items={metadata.tests} />
      <MetadataPanel title="Licenses" items={metadata.licenses} />
      <MetadataPanel title="Environment examples" items={metadata.environmentExamples} />
    </div>
  );
}

function MetadataPanel({ title, items }: { title: string; items: DetectedMetadataItem[] }) {
  return (
    <Panel title={title}>
      <DataTable headers={["Type", "Path"]} rows={items.map((item) => [item.label, item.path])} emptyText={`No ${title.toLowerCase()} detected.`} />
    </Panel>
  );
}

function attentionText(value: number): React.ReactNode {
  return value > 0 ? <StatusBadge tone="attention">{value.toLocaleString()}</StatusBadge> : value.toLocaleString();
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
