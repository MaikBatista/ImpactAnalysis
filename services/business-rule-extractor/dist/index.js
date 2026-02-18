const RULE_PATTERNS = [
    /if\s*\(.+\)/g,
    /switch\s*\(.+\)/g,
    /validate[A-Za-z0-9_]*\(/g,
    /is[A-Za-z0-9_]*Allowed\(/g
];
export class BusinessRuleExtractor {
    extract(input) {
        const matches = RULE_PATTERNS.flatMap((pattern) => [...input.sourceCode.matchAll(pattern)]);
        return matches.map((match, index) => ({
            id: `${input.filePath}#rule-${index}`,
            expression: match[0],
            confidence: 0.65,
            sourceFile: input.filePath
        }));
    }
}
//# sourceMappingURL=index.js.map