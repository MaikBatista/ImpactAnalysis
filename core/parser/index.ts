import fs from "node:fs";
import path from "node:path";
import { Project } from "ts-morph";
import type { ParsedFile } from "../contracts.js";

const DEFAULT_EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git",
  "coverage",
]);

function shouldIgnoreFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").some((segment) => DEFAULT_EXCLUDED_DIRS.has(segment));
}

export class CodeParser {
  parseProject(projectPath: string): ParsedFile[] {
    const tsConfigFilePath = path.join(projectPath, "tsconfig.json");
    const hasTsConfig = fs.existsSync(tsConfigFilePath);

    const project = new Project({
      skipAddingFilesFromTsConfig: !hasTsConfig,
      tsConfigFilePath: hasTsConfig ? tsConfigFilePath : undefined,
    });

    if (!hasTsConfig) {
      project.addSourceFilesAtPaths(path.join(projectPath, "**/*.ts"));
    }

    return project
      .getSourceFiles()
      .filter((sourceFile) => !shouldIgnoreFile(sourceFile.getFilePath()))
      .map((sourceFile) => ({
        filePath: sourceFile.getFilePath(),
        ast: sourceFile,
        language: "ts" as const,
      }));
  }
}
