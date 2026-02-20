import { SyntaxKind, type CallExpression, type Node } from "ts-morph";
import type { ParsedFile, SemanticAnalysis, SemanticNode } from "../contracts.js";

function safeSymbolName(node: Node): string | undefined {
  return node.getSymbol()?.getEscapedName() ?? undefined;
}

function safeTypeName(node: Node): string | undefined {
  const type = node.getType();
  return type ? type.getText(node) : undefined;
}

function enclosingCallableName(node: Node): string {
  const method = node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
  const methodName = method?.getName();
  if (methodName) {
    return methodName;
  }
  const fn = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
  const functionName = fn?.getName();
  if (functionName) {
    return functionName;
  }
  return "<anonymous>";
}

export class SemanticEnricher {
  enrich(parsedFiles: ParsedFile[]): SemanticAnalysis {
    const nodes: SemanticNode[] = [];
    const callGraph = new Map<string, { from: string; to: string; filePath: string }>();

    for (const parsed of parsedFiles) {
      parsed.ast.forEachDescendant((node) => {
        const kindName = node.getKindName();
        const trackedKinds = new Set([
          "ImportDeclaration",
          "ClassDeclaration",
          "EnumDeclaration",
          "MethodDeclaration",
          "PropertyDeclaration",
          "BinaryExpression",
          "IfStatement",
          "ThrowStatement",
          "ReturnStatement",
          "NewExpression",
          "CallExpression",
        ]);

        if (!trackedKinds.has(kindName)) {
          return;
        }

        nodes.push({
          kind: kindName,
          symbol: safeSymbolName(node),
          type: safeTypeName(node),
          filePath: parsed.filePath,
          astNode: node,
        });

        if (node.getKind() !== SyntaxKind.CallExpression) {
          return;
        }

        const callExpression = node as CallExpression;
        const from = `${parsed.filePath}#${enclosingCallableName(callExpression)}`;
        const to = callExpression.getExpression().getText();
        const edgeKey = `${from}->${to}`;
        if (!callGraph.has(edgeKey)) {
          callGraph.set(edgeKey, { from, to, filePath: parsed.filePath });
        }
      });
    }

    return {
      parsedFiles,
      nodes,
      callGraph: [...callGraph.values()],
    };
  }
}
