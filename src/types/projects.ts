export interface SavedProject {
  id: string;
  path: string;
  name: string;
  createdAt: string;
  lastOpenedAt: string | null;
}

export interface CreateSavedProjectInput {
  path: string;
  name?: string;
}

export type SavedProjectPathStatus = "available" | "missing" | "not-directory" | "inaccessible";

export interface SavedProjectWithStatus extends SavedProject {
  pathStatus: SavedProjectPathStatus;
}
