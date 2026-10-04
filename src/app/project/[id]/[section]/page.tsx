import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppShell, type DashboardSection } from "@/components/dashboard/AppShell";
import { RepositoryLoadingState } from "@/components/dashboard/RepositoryLoadingState";
import {
  DependenciesSection,
  FilesSection,
  GitSection,
  HotspotsSection,
  MissingProjectView,
  OverviewSection,
  ProjectSection,
  RelationshipsSection,
} from "@/components/dashboard/sections";
import { getSavedProject, listSavedProjectsWithStatus, touchSavedProject } from "@/lib/projects/projects";
import { analyzeRepository } from "@/server/analysis/repository/analyze";

export const dynamic = "force-dynamic";

const validSections = new Set<DashboardSection>(["overview", "files", "dependencies", "relationships", "hotspots", "git", "project"]);

export default async function ProjectSectionPage({
  params,
}: {
  params: Promise<{
    id: string;
    section: string;
  }>;
}) {
  const { id, section: requestedSection } = await params;
  if (!validSections.has(requestedSection as DashboardSection)) {
    notFound();
  }

  const section = requestedSection as DashboardSection;
  const [savedProjects, savedProject] = await Promise.all([listSavedProjectsWithStatus(), getSavedProject(id)]);

  if (!savedProject) {
    notFound();
  }

  const analysisPromise = analyzeRepository(savedProject.path);

  return (
    <AppShell
      savedProjects={savedProjects}
      activeProjectId={id}
      activeSection={section}
      repositoryDetails={
        <Suspense fallback={<RepositoryLoadingState compact />}>
          <RepositoryHeaderDetails analysisPromise={analysisPromise} />
        </Suspense>
      }
    >
      <Suspense fallback={<RepositoryLoadingState />}>
        <RepositoryAnalysisContent analysisPromise={analysisPromise} projectId={savedProject.id} projectPath={savedProject.path} section={section} />
      </Suspense>
    </AppShell>
  );
}

async function RepositoryHeaderDetails({ analysisPromise }: { analysisPromise: Promise<Awaited<ReturnType<typeof analyzeRepository>>> }) {
  const analysis = await analysisPromise;

  if (!analysis.info.canonicalPath) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
      <span>Branch <span className="font-mono text-[var(--color-text-secondary)]">{analysis.git.branch ?? (analysis.git.detachedHead ? "detached HEAD" : "unavailable")}</span></span>
      <span aria-hidden="true">/</span>
      <span>Analysis complete</span>
    </div>
  );
}

async function RepositoryAnalysisContent({
  analysisPromise,
  projectId,
  projectPath,
  section,
}: {
  analysisPromise: Promise<Awaited<ReturnType<typeof analyzeRepository>>>;
  projectId: string;
  projectPath: string;
  section: DashboardSection;
}) {
  const analysis = await analysisPromise;
  if (analysis.info.canonicalPath) {
    await touchSavedProject(projectId);
  }

  return analysis.info.canonicalPath ? renderSection(section, analysis) : <MissingProjectView path={projectPath} />;
}

function renderSection(section: DashboardSection, analysis: Awaited<ReturnType<typeof analyzeRepository>>) {
  if (section === "files") {
    return <FilesSection analysis={analysis} />;
  }

  if (section === "dependencies") {
    return <DependenciesSection dependencyAnalysis={analysis.dependencyAnalysis} />;
  }

  if (section === "relationships") {
    return <RelationshipsSection sourceRelationships={analysis.sourceRelationships} />;
  }

  if (section === "hotspots") {
    return <HotspotsSection hotspotAnalysis={analysis.hotspotAnalysis} />;
  }

  if (section === "git") {
    return <GitSection analysis={analysis} />;
  }

  if (section === "project") {
    return <ProjectSection metadata={analysis.metadata} />;
  }

  return <OverviewSection analysis={analysis} />;
}
