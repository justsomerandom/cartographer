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

export type DependencyEcosystem = "node" | "rust" | "go" | "python";

export type DependencyCategory = "runtime" | "development" | "optional" | "peer" | "build" | "test" | "unknown";

export interface Dependency {
  name: string;
  version?: string;
  category: DependencyCategory;
  ecosystem: DependencyEcosystem;
  manifestPath: string;
  optional?: boolean;
  indirect?: boolean;
  path?: string;
  git?: string;
  features?: string[];
  source?: string;
}

export interface DependencyGroup {
  category: DependencyCategory;
  count: number;
}

export interface ProjectScript {
  name: string;
  command: string;
  highlighted: boolean;
}

export interface ProjectFramework {
  name: string;
  ecosystem: DependencyEcosystem;
  evidence: string[];
}

export interface WorkspaceInfo {
  isWorkspace: boolean;
  members: string[];
}

export interface ManifestInfo {
  path: string;
  ecosystem: DependencyEcosystem;
  kind: string;
  packageManager?: string;
  lockfiles: string[];
}

export interface ManifestAnalysisError {
  manifestPath: string;
  ecosystem: DependencyEcosystem;
  message: string;
}

export interface DetectedProject {
  id: string;
  rootPath: string;
  manifestPath: string;
  ecosystem: DependencyEcosystem;
  name?: string;
  version?: string;
  private?: boolean;
  packageType?: string;
  packageManager?: string;
  engines?: Record<string, string>;
  manifest: ManifestInfo;
  dependencies: Dependency[];
  dependencyGroups: DependencyGroup[];
  scripts: ProjectScript[];
  technologies: ProjectFramework[];
  workspace?: WorkspaceInfo;
  details: Record<string, string | string[] | boolean | null>;
  errors: ManifestAnalysisError[];
}

export interface EcosystemDependencySummary {
  ecosystem: DependencyEcosystem;
  projectCount: number;
  dependencyCount: number;
}

export interface RepeatedDependency {
  ecosystem: DependencyEcosystem;
  name: string;
  declarations: Array<{
    manifestPath: string;
    version?: string;
  }>;
}

export interface DependencyAnalysisSummary {
  projectCount: number;
  manifestCount: number;
  totalDirectDependencies: number;
  runtimeDependencyCount: number;
  developmentDependencyCount: number;
  optionalDependencyCount: number;
  peerDependencyCount: number;
  buildDependencyCount: number;
  testDependencyCount: number;
  ecosystemSummaries: EcosystemDependencySummary[];
  technologies: ProjectFramework[];
  repeatedDependencies: RepeatedDependency[];
  differingDeclaredVersions: RepeatedDependency[];
}

export interface DependencyAnalysis {
  projects: DetectedProject[];
  summary: DependencyAnalysisSummary;
  errors: ManifestAnalysisError[];
}

export type SourceLanguage = "typescript" | "javascript" | "rust" | "go" | "python";

export type ImportKind =
  | "static-import"
  | "require"
  | "dynamic-import"
  | "re-export"
  | "rust-mod"
  | "rust-use"
  | "go-import"
  | "python-import"
  | "python-from-import";

export type ImportResolutionStatus = "internal" | "external" | "unresolved-local" | "unsupported-dynamic";

export interface SourceModule {
  path: string;
  language: SourceLanguage;
  projectId?: string;
  incomingCount: number;
  outgoingCount: number;
  externalImportCount: number;
  unresolvedImportCount: number;
}

export interface ImportReference {
  sourcePath: string;
  language: SourceLanguage;
  importText: string;
  kind: ImportKind;
  line?: number;
}

export interface ResolvedRelationship {
  sourcePath: string;
  targetPath?: string;
  importText: string;
  kind: ImportKind;
  status: ImportResolutionStatus;
  language: SourceLanguage;
  sourceProjectId?: string;
  targetProjectId?: string;
  crossProject: boolean;
  reason?: string;
}

export interface UnresolvedImport {
  sourcePath: string;
  language: SourceLanguage;
  importText: string;
  kind: ImportKind;
  status: Exclude<ImportResolutionStatus, "internal">;
  reason: string;
}

export interface DependencyCycle {
  modules: string[];
}

export interface ModuleDegree {
  path: string;
  language: SourceLanguage;
  count: number;
  projectId?: string;
}

export interface SourceRelationshipError {
  path: string;
  language: SourceLanguage;
  message: string;
}

export interface RelationshipSummary {
  sourceModulesAnalyzed: number;
  internalRelationshipCount: number;
  externalImportCount: number;
  unresolvedImportCount: number;
  unsupportedDynamicImportCount: number;
  isolatedModuleCount: number;
  cyclicGroupCount: number;
  crossProjectRelationshipCount: number;
  mostDependedOn: ModuleDegree[];
  highestFanOut: ModuleDegree[];
}

export interface SourceRelationshipAnalysis {
  modules: SourceModule[];
  relationships: ResolvedRelationship[];
  importReferences: ImportReference[];
  unresolvedImports: UnresolvedImport[];
  cycles: DependencyCycle[];
  summary: RelationshipSummary;
  errors: SourceRelationshipError[];
}

export interface RepositoryAnalysis {
  info: RepositoryInfo;
  files: FileSummary;
  fileDetails: FileInfo[];
  languages: LanguageSummary[];
  git: GitSummary;
  metadata: ProjectMetadata;
  dependencyAnalysis: DependencyAnalysis;
  sourceRelationships: SourceRelationshipAnalysis;
  markers: MarkerSummary;
  errors: RepositoryAnalysisError[];
}
