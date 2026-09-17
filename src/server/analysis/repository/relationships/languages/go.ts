import type { ImportReference } from "../../../../../types/repository";

export function extractGoImports(sourcePath: string, content: string): ImportReference[] {
  const imports: ImportReference[] = [];
  const lines = content.split(/\r?\n/);
  let inImportBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\/\/.*$/, "").trim();
    if (!line) {
      continue;
    }

    if (line === "import (") {
      inImportBlock = true;
      continue;
    }

    if (inImportBlock && line === ")") {
      inImportBlock = false;
      continue;
    }

    const target = inImportBlock ? goImportTarget(line) : goImportTarget(line.replace(/^import\s+/, ""));
    if (target) {
      imports.push({
        sourcePath,
        language: "go",
        importText: target,
        kind: "go-import",
        line: index + 1,
      });
    }
  }

  return imports;
}

function goImportTarget(line: string): string | undefined {
  const match = line.match(/^(?:[._A-Za-z0-9]+\s+)?["`]([^"`]+)["`]$/);
  return match?.[1];
}
