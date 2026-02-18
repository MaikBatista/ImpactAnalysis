import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import simpleGit from "simple-git";
import AdmZip from "adm-zip";

export interface ImportedRepository {
  id: string;
  localPath: string;
  source: "github" | "zip";
}

export class RepositoryImporter {
  private readonly basePath: string;

  constructor(basePath = path.join(os.tmpdir(), "impact-analysis")) {
    this.basePath = basePath;
  }

  private async createWorkingDir(prefix: string): Promise<{ id: string; dir: string }> {
    await fs.mkdir(this.basePath, { recursive: true });
    const id = `${prefix}-${crypto.randomUUID()}`;
    const dir = path.join(this.basePath, id);
    await fs.mkdir(dir, { recursive: true });
    return { id, dir };
  }

  async fromGitHub(repositoryUrl: string, branch = "main"): Promise<ImportedRepository> {
    const { id, dir } = await this.createWorkingDir("repo");
    await simpleGit().clone(repositoryUrl, dir, ["--branch", branch, "--single-branch"]);

    return {
      id,
      localPath: dir,
      source: "github"
    };
  }

  async fromZip(zipPath: string): Promise<ImportedRepository> {
    const { id, dir } = await this.createWorkingDir("zip");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(dir, true);

    return {
      id,
      localPath: dir,
      source: "zip"
    };
  }
}
