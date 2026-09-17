"use server";

import { analyzeRepository } from "@/server/analysis/repository/analyze";
import { deleteSavedProject, getSavedProject, listSavedProjectsWithStatus, saveProject, touchSavedProject } from "@/lib/projects/projects";
import type { RepositoryAnalysis } from "@/types/repository";
import type { SavedProjectWithStatus } from "@/types/projects";

export interface AnalyzeRepositoryState {
  repositoryPath: string;
  savedProjects: SavedProjectWithStatus[];
  analysis?: RepositoryAnalysis;
  notice?: {
    kind: "success" | "error";
    message: string;
  };
}

export async function repositoryDashboardAction(
  _previousState: AnalyzeRepositoryState,
  formData: FormData,
): Promise<AnalyzeRepositoryState> {
  const intent = String(formData.get("intent") ?? "analyze");

  if (intent === "save") {
    return saveCurrentProject(_previousState, formData);
  }

  if (intent === "open") {
    return openSavedProject(_previousState, formData);
  }

  if (intent === "delete") {
    return deleteProject(_previousState, formData);
  }

  return analyzePath(String(formData.get("repositoryPath") ?? ""), _previousState.savedProjects);
}

async function analyzePath(repositoryPath: string, savedProjects: SavedProjectWithStatus[]): Promise<AnalyzeRepositoryState> {
  return {
    repositoryPath,
    savedProjects,
    analysis: await analyzeRepository(repositoryPath),
  };
}

async function saveCurrentProject(previousState: AnalyzeRepositoryState, formData: FormData): Promise<AnalyzeRepositoryState> {
  const repositoryPath =
    String(formData.get("repositoryPath") ?? "") ||
    previousState.analysis?.info.canonicalPath ||
    previousState.analysis?.info.absolutePath ||
    previousState.repositoryPath;

  try {
    const project = await saveProject(repositoryPath);
    return {
      ...previousState,
      repositoryPath,
      savedProjects: await listSavedProjectsWithStatus(),
      notice: {
        kind: "success",
        message: `${project.name} is saved.`,
      },
    };
  } catch (error: unknown) {
    return {
      ...previousState,
      repositoryPath,
      savedProjects: await listSavedProjectsWithStatus(),
      notice: {
        kind: "error",
        message: error instanceof Error ? error.message : "Project could not be saved.",
      },
    };
  }
}

async function openSavedProject(previousState: AnalyzeRepositoryState, formData: FormData): Promise<AnalyzeRepositoryState> {
  const id = String(formData.get("projectId") ?? "");
  const project = await getSavedProject(id);

  if (!project) {
    return {
      ...previousState,
      savedProjects: await listSavedProjectsWithStatus(),
      notice: {
        kind: "error",
        message: "Saved project was not found.",
      },
    };
  }

  const analysis = await analyzeRepository(project.path);
  if (analysis.info.canonicalPath) {
    await touchSavedProject(project.id);
  }

  return {
    repositoryPath: project.path,
    analysis,
    savedProjects: await listSavedProjectsWithStatus(),
    notice: analysis.info.canonicalPath
      ? {
          kind: "success",
          message: `${project.name} opened.`,
        }
      : {
          kind: "error",
          message: `${project.name} could not be opened. The saved path may be missing.`,
        },
  };
}

async function deleteProject(previousState: AnalyzeRepositoryState, formData: FormData): Promise<AnalyzeRepositoryState> {
  const id = String(formData.get("projectId") ?? "");
  await deleteSavedProject(id);

  return {
    ...previousState,
    savedProjects: await listSavedProjectsWithStatus(),
    notice: {
      kind: "success",
      message: "Saved project removed.",
    },
  };
}
