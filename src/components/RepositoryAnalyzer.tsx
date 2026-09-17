"use client";

import { useActionState } from "react";

import { analyzeRepositoryAction, type AnalyzeRepositoryState } from "@/app/actions";
import type { DetectedMetadataItem, RepositoryAnalysis } from "@/types/repository";

const initialState: AnalyzeRepositoryState = {
  repositoryPath: "",
};

export function RepositoryAnalyzer() {
  const [state, formAction, isPending] = useActionState(analyzeRepositoryAction, initialState);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8">
      <section className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Cartographer v0</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Repository intelligence dashboard</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
            Analyze a local repository from the server side and inspect file, language, Git, metadata, and marker summaries.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-3 rounded border border-slate-300 bg-white p-4 shadow-sm sm:flex-row">
          <label className="sr-only" htmlFor="repositoryPath">
            Repository path
          </label>
          <input
            id="repositoryPath"
            name="repositoryPath"
            defaultValue={state.repositoryPath}
            placeholder="C:\Users\you\projects\example or ../example"
            className="min-h-11 flex-1 rounded border border-slate-300 px-3 text-slate-950 outline-offset-2"
          />
          <button
            type="submit"
            disabled={isPending}
            className="min-h-11 rounded bg-slate-950 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isPending ? "Analyzing..." : "Analyze"}
          </button>
        </form>
      </section>

      {state.analysis ? <AnalysisResult analysis={state.analysis} /> : null}
    </main>
  );
}

function AnalysisResult({ analysis }: { analysis: RepositoryAnalysis }) {
  return (
    <div className="flex flex-col gap-6">
      {analysis.errors.length > 0 ? (
        <section className="rounded border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-950">Analysis notices</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {analysis.errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>
                <span className="font-semibold">{error.code}</span>: {error.message}
                {error.path ? ` (${error.path})` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <InfoCard title="Repository">
          <KeyValue label="Name" value={analysis.info.name ?? "Unavailable"} />
          <KeyValue label="Path" value={analysis.info.canonicalPath ?? analysis.info.absolutePath ?? analysis.info.inputPath} />
          <KeyValue label="Git status" value={gitStatus(analysis)} />
          <KeyValue label="Latest commit" value={analysis.git.latestCommitMessage ?? "Unavailable"} />
        </InfoCard>

        <InfoCard title="Codebase">
          <KeyValue label="Files" value={analysis.files.totalFiles.toLocaleString()} />
          <KeyValue label="Source files" value={analysis.files.sourceFiles.toLocaleString()} />
          <KeyValue label="Size" value={formatBytes(analysis.files.totalBytes)} />
          <KeyValue label="Lines" value={analysis.files.approximateLineCount.toLocaleString()} />
        </InfoCard>

        <InfoCard title="Markers">
          <KeyValue label="TODO" value={analysis.markers.byType.TODO.toLocaleString()} />
          <KeyValue label="FIXME" value={analysis.markers.byType.FIXME.toLocaleString()} />
          <KeyValue label="HACK" value={analysis.markers.byType.HACK.toLocaleString()} />
          <KeyValue label="XXX" value={analysis.markers.byType.XXX.toLocaleString()} />
        </InfoCard>
      </section>

      <DataSection title="Languages">
        <Table
          headers={["Language", "Files", "Lines", "Share"]}
          rows={analysis.languages.map((language) => [
            language.language,
            language.fileCount.toLocaleString(),
            language.lineCount.toLocaleString(),
            `${language.percentage.toFixed(1)}%`,
          ])}
          emptyText="No recognized source languages found."
        />
      </DataSection>

      <DataSection title="Largest files">
        <Table
          headers={["Path", "Size", "Language", "Kind"]}
          rows={analysis.files.largestFiles.map((file) => [
            file.path,
            formatBytes(file.bytes),
            file.language ?? "Unknown",
            file.isBinary ? "Binary" : "Text",
          ])}
          emptyText="No files found."
        />
      </DataSection>

      <DataSection title="Git">
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard title="Summary">
            <KeyValue label="Availability" value={analysis.git.availability} />
            <KeyValue label="Branch" value={analysis.git.branch ?? (analysis.git.detachedHead ? "Detached HEAD" : "Unavailable")} />
            <KeyValue label="Dirty" value={analysis.git.dirty ? "Yes" : "No"} />
            <KeyValue label="Commits" value={analysis.git.totalCommits?.toLocaleString() ?? "Unavailable"} />
          </InfoCard>
          <InfoCard title="Contributors">
            {analysis.git.contributors.length > 0 ? (
              analysis.git.contributors.slice(0, 8).map((contributor) => (
                <KeyValue key={`${contributor.name}-${contributor.email ?? ""}`} label={contributor.name} value={contributor.commitCount.toLocaleString()} />
              ))
            ) : (
              <p className="text-sm text-slate-600">No contributor history found.</p>
            )}
          </InfoCard>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Table
            headers={["Recent commit", "Author", "Timestamp"]}
            rows={analysis.git.recentCommits.map((commit) => [`${commit.shortHash} ${commit.subject}`, commit.author, commit.timestamp])}
            emptyText="No recent commits found."
          />
          <Table
            headers={["Frequently changed file", "Changes"]}
            rows={analysis.git.hotFiles.map((file) => [file.path, file.changeCount.toLocaleString()])}
            emptyText="No file churn data found."
          />
        </div>
      </DataSection>

      <DataSection title="Project metadata">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetadataList title="README" items={analysis.metadata.readmes} />
          <MetadataList title="Manifests" items={analysis.metadata.manifests} />
          <MetadataList title="Docker" items={analysis.metadata.containers} />
          <MetadataList title="CI" items={analysis.metadata.ci} />
          <MetadataList title="Tests" items={analysis.metadata.tests} />
          <MetadataList title="License" items={analysis.metadata.licenses} />
          <MetadataList title="Environment examples" items={analysis.metadata.environmentExamples} />
        </div>
      </DataSection>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function DataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="break-words text-slate-950">{value}</dd>
    </div>
  );
}

function Table({ headers, rows, emptyText }: { headers: string[]; rows: string[][]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-semibold text-slate-700">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`} className="border-b border-slate-100 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`} className="max-w-xl break-words px-3 py-2 text-slate-950">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetadataList({ title, items }: { title: string; items: DetectedMetadataItem[] }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-950">
          {items.slice(0, 8).map((item) => (
            <li key={`${item.label}-${item.path}`}>
              {item.label}: {item.path}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">None detected.</p>
      )}
    </section>
  );
}

function gitStatus(analysis: RepositoryAnalysis): string {
  if (!analysis.git.isRepository) {
    return analysis.git.availability;
  }

  const branch = analysis.git.branch ?? (analysis.git.detachedHead ? "detached" : "unknown branch");
  return `${branch}, ${analysis.git.dirty ? "dirty" : "clean"}`;
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
