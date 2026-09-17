import Link from "next/link";

import { openSavedProjectAction, removeSavedProjectAction, saveProjectAndOpenAction } from "@/app/actions";
import type { SavedProjectWithStatus } from "@/types/projects";
import type { RepositoryAnalysis } from "@/types/repository";
import { RemoveProjectButton } from "./RemoveProjectButton";
import { StatusBadge } from "./ui";

export type DashboardSection = "overview" | "files" | "dependencies" | "relationships" | "hotspots" | "git" | "project";

const sections: Array<{ id: DashboardSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "files", label: "Files" },
  { id: "dependencies", label: "Dependencies" },
  { id: "relationships", label: "Relationships" },
  { id: "hotspots", label: "Hotspots" },
  { id: "git", label: "Git" },
  { id: "project", label: "Project" },
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
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="border-b border-slate-300 bg-slate-950 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-5 p-4">
          <div>
            <Link href="/projects" className="text-lg font-semibold">
              Cartographer
            </Link>
            <p className="mt-1 text-xs text-slate-300">Local repository intelligence</p>
          </div>

          <form action={saveProjectAndOpenAction} className="space-y-2">
            <label htmlFor="repositoryPath" className="text-xs font-semibold uppercase text-slate-300">
              Open repository
            </label>
            <input
              id="repositoryPath"
              name="repositoryPath"
              placeholder="C:\path\to\repo or ../repo"
              className="min-h-10 w-full rounded border border-slate-600 bg-slate-900 px-3 text-sm text-white outline-offset-2 placeholder:text-slate-500"
            />
            <button type="submit" className="min-h-9 w-full rounded bg-white px-3 text-sm font-semibold text-slate-950">
              Analyze and save
            </button>
          </form>

          <nav aria-label="Saved projects" className="space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-300">Saved projects</div>
            {savedProjects.length === 0 ? (
              <p className="rounded border border-slate-700 px-3 py-4 text-sm text-slate-300">No saved projects yet.</p>
            ) : (
              <ul className="space-y-1">
                {savedProjects.map((project) => (
                  <li key={project.id}>
                    <form action={openSavedProjectAction}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="section" value={activeSection ?? "overview"} />
                      <button
                        type="submit"
                        className={`w-full rounded px-3 py-2 text-left text-sm outline-offset-2 ${
                          project.id === activeProjectId ? "bg-white text-slate-950" : "text-slate-200 hover:bg-slate-800"
                        }`}
                      >
                        <span className="block truncate font-semibold">{project.name}</span>
                        <span className="block truncate text-xs opacity-75">{project.path}</span>
                        {project.pathStatus !== "available" ? <span className="mt-1 inline-block text-xs font-semibold text-amber-300">{project.pathStatus}</span> : null}
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
        <header className="border-b border-slate-300 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-950">{analysis?.info.name ?? activeProject?.name ?? "No repository selected"}</h1>
                {activeProject ? <StatusBadge tone="success">Saved</StatusBadge> : <StatusBadge>Unsaved</StatusBadge>}
                {analysis?.git.isRepository ? <StatusBadge tone={analysis.git.dirty ? "attention" : "neutral"}>{analysis.git.dirty ? "Modified" : "Clean"}</StatusBadge> : null}
              </div>
              <p className="mt-1 max-w-4xl break-words text-sm text-slate-600">
                {analysis?.info.canonicalPath ?? activeProject?.path ?? "Open a repository from the sidebar to begin."}
              </p>
              {analysis ? (
                <p className="mt-1 text-xs text-slate-500">
                  Branch {analysis.git.branch ?? (analysis.git.detachedHead ? "detached HEAD" : "unavailable")} - analyzed {formatDate(analysis.info.analyzedAt)}
                </p>
              ) : null}
            </div>
            {activeProject ? (
              <form action={removeSavedProjectAction}>
                <input type="hidden" name="projectId" value={activeProject.id} />
                <RemoveProjectButton />
              </form>
            ) : null}
          </div>

          {activeProjectId ? (
            <nav aria-label="Repository sections" className="mt-4 flex gap-1 overflow-x-auto">
              {sections.map((section) => (
                <Link
                  key={section.id}
                  href={`/project/${activeProjectId}/${section.id}`}
                  className={`rounded px-3 py-2 text-sm font-semibold outline-offset-2 ${
                    section.id === activeSection ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        <main className="px-5 py-5">{children}</main>
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
