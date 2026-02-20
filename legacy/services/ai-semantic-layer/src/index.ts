import OpenAI from "openai";

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

export interface AISemanticLayerOptions {
  provider?: "openai" | "openai-compatible" | "heuristic";
  model?: string;
  baseUrl?: string;
}

function compactList(values: string[], limit = 12): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(
    0,
    limit,
  );
}

function extractHeuristicInsights(input: SemanticPromptInput): SemanticInsights {
  const code = `${input.repositorySummary}\n${input.codeSnippet}`;
  const lines = code.split(/\r?\n/).slice(0, 1200);

  const businessRules = compactList([
    ...lines
      .filter((line) => /(if\s*\(|switch\s*\(|validate|authorize|policy|rule)/i.test(line))
      .map((line) => line.trim().slice(0, 140)),
  ]);

  const domainEntities = compactList([
    ...[...code.matchAll(/\b(class|interface|type)\s+([A-Z][A-Za-z0-9_]+)/g)].map(
      (match) => match[2],
    ),
    ...[...code.matchAll(/\b([A-Z][a-z]+(Service|Repository|Controller|Entity))\b/g)].map(
      (match) => match[1],
    ),
  ]);

  const useCases = compactList([
    ...[...code.matchAll(/\b(create|update|delete|list|get|approve|reject|sync|import|export)[A-Za-z0-9_]*/gi)].map(
      (match) => match[0],
    ),
  ]);

  const architectureSmells = compactList([
    /TODO|FIXME/i.test(code) ? "Technical debt markers present (TODO/FIXME)." : "",
    /controller/i.test(code) && /repository/i.test(code)
      ? "Potential layer coupling between controllers and repositories."
      : "",
    /any\b/.test(code) ? "Broad `any` typing detected; consider stronger typing." : "",
    /process\.env\./.test(code) && !/env service|config/i.test(code)
      ? "Environment access spread across modules; central config may help."
      : "",
  ]);

  return {
    businessRules:
      businessRules.length > 0
        ? businessRules
        : ["Fallback heuristic analysis: no explicit business rules detected."],
    domainEntities,
    useCases,
    architectureSmells,
  };
}

export class AISemanticLayer {
  private readonly client?: OpenAI;
  private readonly provider: NonNullable<AISemanticLayerOptions["provider"]>;
  private readonly model: string;

  constructor(apiKey?: string, options: AISemanticLayerOptions = {}) {
    this.provider = options.provider ?? "openai";
    this.model = options.model ?? "gpt-4.1-mini";

    if (
      (this.provider === "openai" || this.provider === "openai-compatible") &&
      apiKey
    ) {
      this.client = new OpenAI({ apiKey, baseURL: options.baseUrl });
    }
  }

  async analyze(input: SemanticPromptInput): Promise<SemanticInsights> {
    if (this.provider === "heuristic" || !this.client) {
      return extractHeuristicInsights(input);
    }

    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content:
            "Extract business rules, domain entities, use cases, and architecture smells from source code. Respond in JSON."
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
