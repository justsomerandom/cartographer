"use server";

import { analyzeRepository } from "@/server/analysis/repository/analyze";
import type { RepositoryAnalysis } from "@/types/repository";

export interface AnalyzeRepositoryState {
  repositoryPath: string;
  analysis?: RepositoryAnalysis;
}

export async function analyzeRepositoryAction(
  _previousState: AnalyzeRepositoryState,
  formData: FormData,
): Promise<AnalyzeRepositoryState> {
  const repositoryPath = String(formData.get("repositoryPath") ?? "");

  return {
    repositoryPath,
    analysis: await analyzeRepository(repositoryPath),
  };
}
