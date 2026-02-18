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
export declare class CodeAnalyzer {
    analyze(projectPath: string): CodeAnalysisResult;
}
