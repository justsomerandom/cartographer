import ts from "typescript";

import type { ImportKind, ImportReference, SourceLanguage } from "../../../../../types/repository";

export function extractJavaScriptImports(sourcePath: string, content: string, language: SourceLanguage): ImportReference[] {
  const sourceFile = ts.createSourceFile(sourcePath, content, ts.ScriptTarget.Latest, true, sourceKind(sourcePath));
  const imports: ImportReference[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(reference(sourcePath, language, node.moduleSpecifier.text, "static-import", sourceFile, node));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(reference(sourcePath, language, node.moduleSpecifier.text, "re-export", sourceFile, node));
    } else if (ts.isCallExpression(node)) {
      const importText = literalCallTarget(node);
      if (importText) {
        imports.push(reference(sourcePath, language, importText.text, importText.kind, sourceFile, node));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function literalCallTarget(node: ts.CallExpression): { text: string; kind: ImportKind } | undefined {
  const [firstArgument] = node.arguments;
  if (!firstArgument || !ts.isStringLiteral(firstArgument)) {
    return undefined;
  }

  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    return {
      text: firstArgument.text,
      kind: "dynamic-import",
    };
  }

  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    return {
      text: firstArgument.text,
      kind: "require",
    };
  }

  return undefined;
}

function reference(
  sourcePath: string,
  language: SourceLanguage,
  importText: string,
  kind: ImportKind,
  sourceFile: ts.SourceFile,
  node: ts.Node,
): ImportReference {
  return {
    sourcePath,
    language,
    importText,
    kind,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
  };
}

function sourceKind(sourcePath: string): ts.ScriptKind {
  if (sourcePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }

  if (sourcePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }

  if (sourcePath.endsWith(".ts")) {
    return ts.ScriptKind.TS;
  }

  return ts.ScriptKind.JS;
}
