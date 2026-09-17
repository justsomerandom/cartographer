import { AppShell } from "@/components/dashboard/AppShell";
import { ProjectsHome } from "@/components/dashboard/sections";
import { listSavedProjectsWithStatus } from "@/lib/projects/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const savedProjects = await listSavedProjectsWithStatus();

  return (
    <AppShell savedProjects={savedProjects}>
      <ProjectsHome savedCount={savedProjects.length} />
    </AppShell>
  );
}
