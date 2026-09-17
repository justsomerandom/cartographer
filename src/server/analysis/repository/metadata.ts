import path from "node:path";

import type { DetectedMetadataItem, FileInfo, ProjectMetadata } from "../../../types/repository";

const manifestFiles = new Map<string, string>([
  ["package.json", "npm package"],
  ["Cargo.toml", "Cargo manifest"],
  ["go.mod", "Go module"],
  ["pyproject.toml", "Python project"],
  ["requirements.txt", "Python requirements"],
  ["pom.xml", "Maven project"],
  ["build.gradle", "Gradle project"],
  ["build.gradle.kts", "Gradle Kotlin project"],
]);

const containerFiles = new Map<string, string>([
  ["Dockerfile", "Dockerfile"],
  ["docker-compose.yml", "Docker Compose"],
  ["docker-compose.yaml", "Docker Compose"],
  ["compose.yml", "Docker Compose"],
  ["compose.yaml", "Docker Compose"],
  [".dockerignore", "Docker ignore"],
]);

const environmentFiles = new Map<string, string>([
  [".env.example", "Environment example"],
  [".env.sample", "Environment sample"],
]);

const licenseFiles = new Map<string, string>([
  ["LICENSE", "License"],
  ["LICENSE.txt", "License"],
  ["LICENSE.md", "License"],
  ["COPYING", "License"],
]);

export function detectProjectMetadata(files: FileInfo[], directories: string[]): ProjectMetadata {
  const metadata: ProjectMetadata = {
    readmes: [],
    manifests: [],
    containers: [],
    ci: [],
    tests: [],
    environmentExamples: [],
    licenses: [],
  };

  const directorySet = new Set(directories.map(normalizePath));

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    const filename = normalizedPath.split("/").at(-1) ?? normalizedPath;

    if (/^README(\.|$)/i.test(filename)) {
      metadata.readmes.push(item("README", normalizedPath));
    }

    pushKnown(metadata.manifests, manifestFiles, filename, normalizedPath);
    pushKnown(metadata.containers, containerFiles, filename, normalizedPath);
    pushKnown(metadata.environmentExamples, environmentFiles, filename, normalizedPath);
    pushKnown(metadata.licenses, licenseFiles, filename, normalizedPath);

    if (normalizedPath.startsWith(".github/workflows/")) {
      metadata.ci.push(item("GitHub Actions workflow", normalizedPath));
    }

    if (filename === ".gitlab-ci.yml") {
      metadata.ci.push(item("GitLab CI", normalizedPath));
    }

    if (isTestFile(normalizedPath)) {
      metadata.tests.push(item("Test file", normalizedPath));
    }
  }

  for (const testDirectory of ["tests", "test", "__tests__"]) {
    if (directorySet.has(testDirectory) || [...directorySet].some((dir) => dir.endsWith(`/${testDirectory}`))) {
      metadata.tests.push(item("Test directory", testDirectory));
    }
  }

  return dedupeMetadata(metadata);
}

function pushKnown(
  target: DetectedMetadataItem[],
  knownFiles: Map<string, string>,
  filename: string,
  filePath: string,
): void {
  const label = knownFiles.get(filename);
  if (label) {
    target.push(item(label, filePath));
  }
}

function isTestFile(filePath: string): boolean {
  const filename = filePath.split("/").at(-1) ?? filePath;
  return (
    /\.(test|spec)\.[^.]+$/i.test(filename) ||
    /_test\.go$/i.test(filename) ||
    /_test\.py$/i.test(filename)
  );
}

function item(label: string, filePath: string): DetectedMetadataItem {
  return { label, path: filePath };
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function dedupeMetadata(metadata: ProjectMetadata): ProjectMetadata {
  return {
    readmes: dedupeItems(metadata.readmes),
    manifests: dedupeItems(metadata.manifests),
    containers: dedupeItems(metadata.containers),
    ci: dedupeItems(metadata.ci),
    tests: dedupeItems(metadata.tests),
    environmentExamples: dedupeItems(metadata.environmentExamples),
    licenses: dedupeItems(metadata.licenses),
  };
}

function dedupeItems(items: DetectedMetadataItem[]): DetectedMetadataItem[] {
  return [...new Map(items.map((entry) => [`${entry.label}:${entry.path}`, entry])).values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
}
