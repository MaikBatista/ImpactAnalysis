export interface CandidateRule {
    id: string;
    expression: string;
    confidence: number;
    sourceFile: string;
}
export interface BusinessRuleExtractionInput {
    filePath: string;
    sourceCode: string;
}
export declare class BusinessRuleExtractor {
    extract(input: BusinessRuleExtractionInput): CandidateRule[];
}
