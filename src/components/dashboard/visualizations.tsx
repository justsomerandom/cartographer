import type { GitSummary, LanguageSummary, SourceRelationshipAnalysis } from "@/types/repository";

export function LanguageComposition({ languages }: { languages: LanguageSummary[] }) {
  const shown = languages.slice(0, 6);
  if (!shown.length) return <p className="text-sm text-[var(--color-text-secondary)]">No recognized source language data.</p>;
  return <div className="space-y-2">{shown.map((language, index) => <div key={language.language}><div className="flex justify-between gap-3 text-xs"><span>{language.language}</span><span className="tabular-nums">{language.percentage.toFixed(1)}% · {language.lineCount.toLocaleString()} lines</span></div><div className="mt-1 h-2 rounded bg-[var(--color-surface-hover)]"><div className="h-2 rounded bg-[var(--chart-cyan)]" style={{ width: `${Math.max(language.percentage, 1)}%`, opacity: 1 - index * 0.08 }} /></div></div>)}</div>;
}

export function ActivityTrend({ git }: { git: GitSummary }) {
  const buckets = new Map<string, number>();
  for (const commit of git.recentCommits) { const day = commit.timestamp.slice(0, 10); buckets.set(day, (buckets.get(day) ?? 0) + 1); }
  const values = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-10);
  const max = Math.max(1, ...values.map(([, count]) => count));
  if (!values.length) return <p className="text-sm text-[var(--color-text-secondary)]">No local commit history is available.</p>;
  return <div className="flex h-28 items-end gap-1" aria-label="Recent commit activity trend">{values.map(([day, count]) => <div key={day} className="group flex min-w-0 flex-1 flex-col justify-end"><span className="sr-only">{day}: {count} commits</span><div title={`${day}: ${count} commits`} className="rounded-t bg-[var(--chart-cyan)]" style={{ height: `${Math.max(8, (count / max) * 100)}%` }} /><span className="mt-1 truncate text-center text-[10px] text-[var(--color-text-muted)]">{day.slice(5)}</span></div>)}</div>;
}

export function ArchitectureSummary({ relationships }: { relationships: SourceRelationshipAnalysis }) {
  const total = Math.max(1, relationships.summary.sourceModulesAnalyzed);
  const connected = total - relationships.summary.isolatedModuleCount;
  return <div className="space-y-3"><div className="flex h-3 overflow-hidden rounded bg-[var(--color-surface-hover)]"><div className="bg-[var(--chart-cyan)]" style={{ width: `${(connected / total) * 100}%` }} /><div className="bg-[var(--chart-slate)]" style={{ width: `${(relationships.summary.isolatedModuleCount / total) * 100}%` }} /></div><dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><Metric label="Connected modules" value={connected} /><Metric label="Isolated modules" value={relationships.summary.isolatedModuleCount} /><Metric label="Cross-project edges" value={relationships.summary.crossProjectRelationshipCount} /><Metric label="Cyclic groups" value={relationships.summary.cyclicGroupCount} /></dl></div>;
}

export function ContributorDistribution({ git }: { git: GitSummary }) {
  const total = Math.max(1, git.contributors.reduce((sum, contributor) => sum + contributor.commitCount, 0));
  return <div className="space-y-2">{git.contributors.slice(0, 8).map((contributor) => <div key={`${contributor.name}-${contributor.email ?? ""}`}><div className="flex justify-between gap-2 text-xs"><span className="truncate">{contributor.name}</span><span>{contributor.commitCount}</span></div><div className="mt-1 h-1.5 rounded bg-[var(--color-surface-hover)]"><div className="h-1.5 rounded bg-[var(--chart-indigo)]" style={{ width: `${(contributor.commitCount / total) * 100}%` }} /></div></div>)}</div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div><dt className="text-xs text-[var(--color-text-muted)]">{label}</dt><dd className="font-semibold tabular-nums">{value.toLocaleString()}</dd></div>; }
