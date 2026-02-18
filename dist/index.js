import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import simpleGit from "simple-git";
import AdmZip from "adm-zip";
export class RepositoryImporter {
    basePath;
    constructor(basePath = path.join(os.tmpdir(), "impact-analysis")) {
        this.basePath = basePath;
    }
    async createWorkingDir(prefix) {
        await fs.mkdir(this.basePath, { recursive: true });
        const id = `${prefix}-${crypto.randomUUID()}`;
        const dir = path.join(this.basePath, id);
        await fs.mkdir(dir, { recursive: true });
        return { id, dir };
    }
    async fromGitHub(repositoryUrl, branch = "main") {
        const { id, dir } = await this.createWorkingDir("repo");
        await simpleGit().clone(repositoryUrl, dir, ["--branch", branch, "--single-branch"]);
        return {
            id,
            localPath: dir,
            source: "github"
        };
    }
    async fromZip(zipPath) {
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
//# sourceMappingURL=index.js.map