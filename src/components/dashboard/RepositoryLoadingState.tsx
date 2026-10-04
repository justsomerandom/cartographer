import { LoadingState, Panel, SectionHeader, StatusBadge } from "./ui";

export function RepositoryLoadingState({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div aria-live="polite" role="status" className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
        <StatusBadge tone="info">Analyzing</StatusBadge>
        <span>Repository details will appear as collection completes.</span>
      </div>
    );
  }

  return (
    <div aria-live="polite" role="status" className="space-y-6">
      <SectionHeader
        eyebrow="Repository analysis"
        title="Collecting repository details"
        description="The workspace is ready. Cartographer is scanning files and collecting Git, dependency, and module information in the background."
      />
      <Panel title="Analysis in progress" description="Large repositories can take a little longer. This page will update automatically when the collected results are ready.">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Indexing repository data…</p>
        </div>
        <div className="mt-4"><LoadingState rows={5} /></div>
      </Panel>
    </div>
  );
}
