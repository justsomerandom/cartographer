import { RepositoryAnalyzer } from "@/components/RepositoryAnalyzer";
import { listSavedProjectsWithStatus } from "@/lib/projects/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const savedProjects = await listSavedProjectsWithStatus();

  return <RepositoryAnalyzer initialSavedProjects={savedProjects} />;
}
