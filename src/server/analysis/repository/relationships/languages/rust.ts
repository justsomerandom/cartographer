import type { ImportReference } from "../../../../../types/repository";

export function extractRustImports(sourcePath: string, content: string): ImportReference[] {
  const imports: ImportReference[] = [];
  const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = withoutBlockComments.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\/\/.*$/, "").trim();
    if (!line) {
      continue;
    }

    const modMatch = line.match(/^pub\s+mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;|^mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/);
    const inlineModMatch = line.match(/^pub\s+mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{|^mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    const moduleName = modMatch?.[1] ?? modMatch?.[2] ?? inlineModMatch?.[1] ?? inlineModMatch?.[2];
    if (moduleName) {
      imports.push({
        sourcePath,
        language: "rust",
        importText: moduleName,
        kind: "rust-mod",
        line: index + 1,
      });
    }

    const useMatch = line.match(/^use\s+([^;]+);/);
    if (useMatch) {
      for (const importText of expandRustUse(useMatch[1])) {
        imports.push({
          sourcePath,
          language: "rust",
          importText,
          kind: "rust-use",
          line: index + 1,
        });
      }
    }
  }

  return imports;
}

function expandRustUse(useText: string): string[] {
  const cleaned = useText.trim();
  const braceMatch = cleaned.match(/^(.*)::\{(.+)\}$/);
  if (!braceMatch) {
    return [cleaned];
  }

  const prefix = braceMatch[1];
  return braceMatch[2]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${prefix}::${part}`);
}
