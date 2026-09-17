import type { RepositoryAnalysisError, RepositoryAnalysisErrorCode } from "../../../types/repository";

export function analysisError(
  code: RepositoryAnalysisErrorCode,
  message: string,
  options: { path?: string; detail?: string } = {},
): RepositoryAnalysisError {
  return {
    code,
    message,
    ...options,
  };
}

export function errorDetail(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return undefined;
}
