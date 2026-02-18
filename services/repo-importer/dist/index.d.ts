export interface ImportedRepository {
    id: string;
    localPath: string;
    source: "github" | "zip";
}
export declare class RepositoryImporter {
    private readonly basePath;
    constructor(basePath?: string);
    private createWorkingDir;
    fromGitHub(repositoryUrl: string, branch?: string): Promise<ImportedRepository>;
    fromZip(zipPath: string): Promise<ImportedRepository>;
}
