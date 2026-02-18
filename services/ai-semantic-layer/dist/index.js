import OpenAI from "openai";
export class AISemanticLayer {
    client;
    constructor(apiKey) {
        if (apiKey) {
            this.client = new OpenAI({ apiKey });
        }
    }
    async analyze(input) {
        if (!this.client) {
            return {
                businessRules: ["Fallback semantic analysis: no LLM credentials configured."],
                domainEntities: [],
                useCases: [],
                architectureSmells: []
            };
        }
        const response = await this.client.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: "Extract business rules, domain entities, use cases, and architecture smells from source code. Respond in JSON."
                },
                {
                    role: "user",
                    content: `Repository Summary:\n${input.repositorySummary}\n\nCode Snippet:\n${input.codeSnippet}`
                }
            ],
            text: { format: { type: "json_object" } }
        });
        const payload = JSON.parse(response.output_text);
        return {
            businessRules: payload.businessRules ?? [],
            domainEntities: payload.domainEntities ?? [],
            useCases: payload.useCases ?? [],
            architectureSmells: payload.architectureSmells ?? []
        };
    }
}
//# sourceMappingURL=index.js.map