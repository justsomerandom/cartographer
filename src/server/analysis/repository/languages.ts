const extensionLanguages = new Map<string, string>([
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".rs", "Rust"],
  [".go", "Go"],
  [".py", "Python"],
  [".java", "Java"],
  [".c", "C"],
  [".h", "C"],
  [".cpp", "C++"],
  [".cc", "C++"],
  [".cxx", "C++"],
  [".hpp", "C++"],
  [".cs", "C#"],
  [".html", "HTML"],
  [".htm", "HTML"],
  [".css", "CSS"],
  [".scss", "CSS"],
  [".sh", "Shell"],
  [".bash", "Shell"],
  [".sql", "SQL"],
  [".json", "JSON"],
  [".yml", "YAML"],
  [".yaml", "YAML"],
  [".md", "Markdown"],
  [".mdx", "Markdown"],
]);

const filenameLanguages = new Map<string, string>([
  ["dockerfile", "Dockerfile"],
  ["containerfile", "Dockerfile"],
  ["makefile", "Makefile"],
  ["justfile", "Makefile"],
  ["rakefile", "Ruby"],
  ["gemfile", "Ruby"],
]);

export function detectLanguage(relativePath: string): string | undefined {
  const normalized = relativePath.replaceAll("\\", "/");
  const filename = normalized.split("/").at(-1)?.toLowerCase() ?? normalized.toLowerCase();
  const namedLanguage = filenameLanguages.get(filename);

  if (namedLanguage) {
    return namedLanguage;
  }

  const extensionStart = filename.lastIndexOf(".");
  if (extensionStart < 0) {
    return undefined;
  }

  return extensionLanguages.get(filename.slice(extensionStart));
}

export function isRecognizedSourceLanguage(language: string | undefined): boolean {
  return Boolean(language);
}
