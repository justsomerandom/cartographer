import Link from "next/link";

import { openSavedProjectAction, removeSavedProjectAction, saveProjectAndOpenAction } from "@/app/actions";
import type { SavedProjectWithStatus } from "@/types/projects";
import type { RepositoryAnalysis } from "@/types/repository";
import { RemoveProjectButton } from "./RemoveProjectButton";
import { AppMark, Icon, StatusBadge } from "./ui";

export type DashboardSection = "overview" | "files" | "dependencies" | "relationships" | "hotspots" | "git" | "project";

const sections: Array<{ id: DashboardSection; label: string; icon: Parameters<typeof Icon>[0]["name"] }> = [
  { id: "overview", label: "Overview", icon: "graph" },
  { id: "files", label: "Files", icon: "folder" },
  { id: "dependencies", label: "Dependencies", icon: "layers" },
  { id: "relationships", label: "Relationships", icon: "branch" },
  { id: "hotspots", label: "Hotspots", icon: "flame" },
  { id: "git", label: "Git", icon: "git" },
  { id: "project", label: "Project", icon: "box" },
];

export function AppShell({
  savedProjects,
  activeProjectId,
  activeSection,
  analysis,
  children,
}: {
  savedProjects: SavedProjectWithStatus[];
  activeProjectId?: string;
  activeSection?: DashboardSection;
  analysis?: RepositoryAnalysis;
  children: React.ReactNode;
}) {
  const activeProject = savedProjects.find((project) => project.id === activeProjectId);

  return (
    <div className="min-h-screen text-[var(--color-text)] lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-slate-700 bg-[var(--color-sidebar)] text-[var(--color-text-inverse)] lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex min-h-full flex-col gap-6 p-4">
          <div className="flex items-center gap-3">
            <AppMark />
            <Link href="/projects" className="min-w-0">
              <span className="block text-base font-semibold leading-tight">Cartographer</span>
              <span className="block text-xs text-slate-300">Repository intelligence</span>
            </Link>
          </div>

          <form action={saveProjectAndOpenAction} className="space-y-2 rounded-[var(--radius-md)] border border-slate-700/80 bg-[var(--color-sidebar-subtle)] p-3">
            <label htmlFor="repositoryPath" className="text-xs font-medium uppercase tracking-[0.06em] text-slate-300">
              Open repository
            </label>
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-slate-600 bg-slate-950 px-2">
              <Icon name="search" className="size-4 shrink-0 text-slate-400" />
              <input
                id="repositoryPath"
                name="repositoryPath"
                placeholder="C:\path\to\repo or ../repo"
                className="min-h-9 w-full min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <button type="submit" className="inline-flex min-h-8 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-cyan-100 px-3 text-sm font-semibold text-slate-950 hover:bg-white">
              <Icon name="plus" className="size-4" />
              Analyze
            </button>
          </form>

          {activeProjectId ? (
            <nav aria-label="Repository sections" className="space-y-1">
              <div className="px-2 text-xs font-medium uppercase tracking-[0.06em] text-slate-400">Sections</div>
              {sections.map((section) => {
                const selected = section.id === activeSection;
                return (
                  <Link
                    key={section.id}
                    href={`/project/${activeProjectId}/${section.id}`}
                    aria-current={selected ? "page" : undefined}
                    className={`group flex items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-sm font-medium outline-offset-2 ${
                      selected
                        ? "bg-[var(--color-sidebar-selected)] text-slate-950"
                        : "text-slate-300 hover:bg-[var(--color-sidebar-hover)] hover:text-white"
                    }`}
                  >
                    <span className={`h-4 w-0.5 rounded-full ${selected ? "bg-[var(--color-accent)]" : "bg-transparent group-hover:bg-slate-500"}`} />
                    <Icon name={section.icon} className="size-4 shrink-0" />
                    {section.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <nav aria-label="Saved projects" className="min-h-0 flex-1 space-y-2">
            <div className="px-2 text-xs font-medium uppercase tracking-[0.06em] text-slate-400">Saved projects</div>
            {savedProjects.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-slate-700 px-3 py-4 text-sm text-slate-300">No saved projects yet.</p>
            ) : (
              <ul className="max-h-[38vh] space-y-1 overflow-y-auto pr-1 lg:max-h-none">
                {savedProjects.map((project) => (
                  <li key={project.id}>
                    <form action={openSavedProjectAction}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="section" value={activeSection ?? "overview"} />
                      <button
                        type="submit"
                        className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm outline-offset-2 ${
                          project.id === activeProjectId
                            ? "border-cyan-200/50 bg-cyan-50/10 text-white"
                            : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-[var(--color-sidebar-hover)]"
                        }`}
                      >
                        <span className="block truncate font-medium">{project.name}</span>
                        <span className="block truncate font-mono text-xs text-slate-400">{project.path}</span>
                        {project.pathStatus !== "available" ? <span className="mt-1 inline-block text-xs font-medium text-amber-300">{project.pathStatus}</span> : null}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 lg:px-8">
          <div className="mx-auto flex max-w-[100rem] flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold leading-tight text-[var(--color-text)]">{analysis?.info.name ?? activeProject?.name ?? "No repository selected"}</h1>
                {activeProject ? <StatusBadge tone="success">Saved</StatusBadge> : <StatusBadge>Unsaved</StatusBadge>}
                {analysis?.git.isRepository ? <StatusBadge tone={analysis.git.dirty ? "attention" : "success"}>{analysis.git.dirty ? "Modified" : "Clean"}</StatusBadge> : null}
              </div>
              <p className="mt-1 max-w-5xl break-words font-mono text-xs text-[var(--color-text-secondary)]">
                {analysis?.info.canonicalPath ?? activeProject?.path ?? "Open a repository from the sidebar to begin."}
              </p>
              {analysis ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>
                    Branch <span className="font-mono text-[var(--color-text-secondary)]">{analysis.git.branch ?? (analysis.git.detachedHead ? "detached HEAD" : "unavailable")}</span>
                  </span>
                  <span aria-hidden="true">/</span>
                  <span>Analyzed {formatDate(analysis.info.analyzedAt)}</span>
                </div>
              ) : null}
            </div>
            {activeProject ? (
              <form action={removeSavedProjectAction}>
                <input type="hidden" name="projectId" value={activeProject.id} />
                <RemoveProjectButton />
              </form>
            ) : null}
          </div>
        </header>

        <main className="mx-auto max-w-[100rem] px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
