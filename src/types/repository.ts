export type RepositoryAnalysisErrorCode =
  | "EMPTY_PATH"
  | "PATH_NOT_FOUND"
  | "PATH_NOT_DIRECTORY"
  | "PATH_ACCESS_DENIED"
  | "PATH_RESOLUTION_FAILED"
  | "FILESYSTEM_ERROR"
  | "GIT_NOT_INSTALLED"
  | "GIT_COMMAND_FAILED";

export interface RepositoryAnalysisError {
  code: RepositoryAnalysisErrorCode;
  message: string;
  path?: string;
  detail?: string;
}

export interface RepositoryInfo {
  inputPath: string;
  absolutePath?: string;
  canonicalPath?: string;
  name?: string;
  analyzedAt: string;
}

export interface LargestFileInfo {
  path: string;
  bytes: number;
  language?: string;
  isBinary: boolean;
}

export interface FileInfo {
  path: string;
  bytes: number;
  isBinary: boolean;
  isText: boolean;
  isSource: boolean;
  language?: string;
  lineCount?: number;
}

export interface FileSummary {
  totalFiles: number;
  sourceFiles: number;
  textFiles: number;
  binaryFiles: number;
  directoryCount: number;
  totalBytes: number;
  approximateLineCount: number;
  largestFiles: LargestFileInfo[];
}

export interface LanguageSummary {
  language: string;
  fileCount: number;
  lineCount: number;
  byteCount: number;
  percentage: number;
}

export type GitAvailability = "available" | "not-installed" | "not-repository" | "error";

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  timestamp: string;
  subject: string;
}

export interface GitContributor {
  name: string;
  email?: string;
  commitCount: number;
}

export interface GitHotFile {
  path: string;
  changeCount: number;
}

export interface GitSummary {
  availability: GitAvailability;
  isRepository: boolean;
  gitRoot?: string;
  branch?: string;
  detachedHead: boolean;
  dirty: boolean;
  headCommit?: string;
  latestCommitMessage?: string;
  latestCommitTimestamp?: string;
  totalCommits?: number;
  contributors: GitContributor[];
  recentCommits: GitCommit[];
  hotFiles: GitHotFile[];
  errors: RepositoryAnalysisError[];
}

export interface DetectedMetadataItem {
  label: string;
  path: string;
}

export interface ProjectMetadata {
  readmes: DetectedMetadataItem[];
  manifests: DetectedMetadataItem[];
  containers: DetectedMetadataItem[];
  ci: DetectedMetadataItem[];
  tests: DetectedMetadataItem[];
  environmentExamples: DetectedMetadataItem[];
  licenses: DetectedMetadataItem[];
}

export type MarkerType = "TODO" | "FIXME" | "HACK" | "XXX";

export interface MarkerFileSummary {
  path: string;
  count: number;
}

export interface MarkerSummary {
  total: number;
  byType: Record<MarkerType, number>;
  topFiles: MarkerFileSummary[];
}

export interface RepositoryAnalysis {
  info: RepositoryInfo;
  files: FileSummary;
  languages: LanguageSummary[];
  git: GitSummary;
  metadata: ProjectMetadata;
  markers: MarkerSummary;
  errors: RepositoryAnalysisError[];
}
