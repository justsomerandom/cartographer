import type { ImportReference } from "../../../../../types/repository";

export function extractPythonImports(sourcePath: string, content: string): ImportReference[] {
  const imports: ImportReference[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\s+#.*$/, "").trim();
    if (!line) {
      continue;
    }

    const importMatch = line.match(/^import\s+(.+)$/);
    if (importMatch) {
      for (const importText of importMatch[1].split(",").map((item) => item.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        imports.push({
          sourcePath,
          language: "python",
          importText,
          kind: "python-import",
          line: index + 1,
        });
      }
      continue;
    }

    const fromMatch = line.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
    if (fromMatch) {
      const moduleName = fromMatch[1];
      const importedNames = fromMatch[2].split(",").map((item) => item.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const importTexts =
        moduleName.startsWith(".") && importedNames.length > 0
          ? importedNames.map((name) => `${moduleName}${moduleName.endsWith(".") ? "" : "."}${name}`)
          : [moduleName];
      for (const importText of importTexts) {
        imports.push({
          sourcePath,
          language: "python",
          importText,
          kind: "python-from-import",
          line: index + 1,
        });
      }
    }
  }

  return imports;
}
