import path from "node:path";
import { Project, SyntaxKind } from "ts-morph";
const ENDPOINT_METHODS = ["get", "post", "put", "patch", "delete"];
export class CodeAnalyzer {
    analyze(projectPath) {
        const project = new Project({
            tsConfigFilePath: path.join(projectPath, "tsconfig.json"),
            skipAddingFilesFromTsConfig: false
        });
        const files = project
            .getSourceFiles()
            .filter((file) => !file.getFilePath().includes("node_modules"))
            .map((sourceFile) => {
            const imports = sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());
            const exportedFunctions = sourceFile
                .getFunctions()
                .filter((func) => func.isExported())
                .map((func) => func.getName() ?? "anonymous");
            const endpoints = [];
            const databaseInteractions = [];
            const functionDependencies = [];
            sourceFile.forEachDescendant((node) => {
                if (node.getKind() !== SyntaxKind.CallExpression) {
                    return;
                }
                const callExpr = node.asKindOrThrow(SyntaxKind.CallExpression);
                const expressionText = callExpr.getExpression().getText();
                const lower = expressionText.toLowerCase();
                if (ENDPOINT_METHODS.some((method) => lower.includes(`.${method}`))) {
                    endpoints.push(callExpr.getText());
                }
                if (["select", "insert", "update", "delete", "query"].some((keyword) => lower.includes(keyword))) {
                    databaseInteractions.push(callExpr.getText());
                }
                const enclosingFunction = callExpr.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
                if (enclosingFunction?.getName()) {
                    functionDependencies.push({
                        caller: enclosingFunction.getNameOrThrow(),
                        callee: expressionText,
                        filePath: sourceFile.getFilePath()
                    });
                }
            });
            return {
                filePath: sourceFile.getFilePath(),
                imports,
                exportedFunctions,
                endpoints,
                databaseInteractions,
                functionDependencies
            };
        });
        return { files };
    }
}
//# sourceMappingURL=index.js.map