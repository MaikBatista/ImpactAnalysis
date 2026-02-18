export interface SemanticPromptInput {
    repositorySummary: string;
    codeSnippet: string;
}
export interface SemanticInsights {
    businessRules: string[];
    domainEntities: string[];
    useCases: string[];
    architectureSmells: string[];
}
export declare class AISemanticLayer {
    private readonly client?;
    constructor(apiKey?: string);
    analyze(input: SemanticPromptInput): Promise<SemanticInsights>;
}
