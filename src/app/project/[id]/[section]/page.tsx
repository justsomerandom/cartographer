import { notFound } from "next/navigation";

import { AppShell, type DashboardSection } from "@/components/dashboard/AppShell";
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

  const analysis = await analyzeRepository(savedProject.path);
  if (analysis.info.canonicalPath) {
    await touchSavedProject(savedProject.id);
  }

  return (
    <AppShell savedProjects={savedProjects} activeProjectId={id} activeSection={section} analysis={analysis.info.canonicalPath ? analysis : undefined}>
      {analysis.info.canonicalPath ? renderSection(section, analysis) : <MissingProjectView path={savedProject.path} />}
    </AppShell>
  );
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
