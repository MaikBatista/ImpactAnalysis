import path from "node:path";
import { Project, SyntaxKind } from "ts-morph";

export interface FunctionDependency {
  caller: string;
  callee: string;
  filePath: string;
}

export interface SourceFileAnalysis {
  filePath: string;
  imports: string[];
  exportedFunctions: string[];
  endpoints: string[];
  databaseInteractions: string[];
  functionDependencies: FunctionDependency[];
}

export interface CodeAnalysisResult {
  files: SourceFileAnalysis[];
}

const ENDPOINT_METHODS = ["get", "post", "put", "patch", "delete"];
const DEFAULT_EXCLUDED_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git",
  "coverage",
];

export interface CodeAnalyzerOptions {
  excludeDirs?: string[];
  onlyInternalImports?: boolean;
}

function shouldIgnoreFile(filePath: string, excludedDirs: Set<string>): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments.some((segment) => excludedDirs.has(segment));
}

export class CodeAnalyzer {
  analyze(
    projectPath: string,
    options: CodeAnalyzerOptions = {},
  ): CodeAnalysisResult {
    const excludedDirs = new Set(
      (options.excludeDirs?.length ? options.excludeDirs : DEFAULT_EXCLUDED_DIRS)
        .map((dir) => dir.trim())
        .filter((dir) => dir.length > 0),
    );
    const onlyInternalImports = options.onlyInternalImports ?? true;

    const project = new Project({
      tsConfigFilePath: path.join(projectPath, "tsconfig.json"),
      skipAddingFilesFromTsConfig: false
    });

    const files = project
      .getSourceFiles()
      .filter((file) => !shouldIgnoreFile(file.getFilePath(), excludedDirs))
      .map((sourceFile): SourceFileAnalysis => {
        const imports = [...new Set(
          sourceFile.getImportDeclarations().flatMap((declaration) => {
            const importedFile = declaration.getModuleSpecifierSourceFile();
            if (importedFile) {
              const importedPath = importedFile.getFilePath();
              return shouldIgnoreFile(importedPath, excludedDirs) ? [] : [importedPath];
            }

            if (onlyInternalImports) {
              return [];
            }

            return [declaration.getModuleSpecifierValue()];
          }),
        )];
        const exportedFunctions = sourceFile
          .getFunctions()
          .filter((func) => func.isExported())
          .map((func) => func.getName() ?? "anonymous");

        const endpoints: string[] = [];
        const databaseInteractions: string[] = [];
        const functionDependencies: FunctionDependency[] = [];

        sourceFile.forEachDescendant((node) => {
          if (node.getKind() !== SyntaxKind.CallExpression) {
            return;
          }

          const callExpr = node.asKindOrThrow(SyntaxKind.CallExpression);
          const expressionText = callExpr.getExpression().getText();
          const lower = expressionText.toLowerCase();

          if (ENDPOINT_METHODS.some((method) => lower.includes(`.${method}`))) {
            endpoints.push(callExpr.getText());
          }

          if (["select", "insert", "update", "delete", "query"].some((keyword) => lower.includes(keyword))) {
            databaseInteractions.push(callExpr.getText());
          }

          const enclosingFunction = callExpr.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
          if (enclosingFunction?.getName()) {
            functionDependencies.push({
              caller: enclosingFunction.getNameOrThrow(),
              callee: expressionText,
              filePath: sourceFile.getFilePath()
            });
          }
        });

        return {
          filePath: sourceFile.getFilePath(),
          imports,
          exportedFunctions,
          endpoints,
          databaseInteractions,
          functionDependencies
        };
      });

    return { files };
  }
}
