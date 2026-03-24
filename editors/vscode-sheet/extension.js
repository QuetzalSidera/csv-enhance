"use strict";

const vscode = require("vscode");
const path = require("path");
const { SheetLinter } = require("./dist/lint/linter");
const { SheetLanguageService } = require("./dist/editor/language-service");

function activate(context) {
  const linter = new SheetLinter();
  const languageService = new SheetLanguageService();
  const diagnostics = vscode.languages.createDiagnosticCollection("csvx");

  const refreshDocument = (document) => {
    if (!document || document.languageId !== "csvx") {
      return;
    }

    const result = linter.lintSource(document.getText(), document.uri.scheme === "file" ? document.uri.fsPath : undefined);
    const editorDiagnostics = result.issues.map(toVscodeDiagnostic);
    diagnostics.set(document.uri, editorDiagnostics);
  };

  const clearDocument = (document) => {
    if (!document) {
      return;
      
    }
    diagnostics.delete(document.uri);
  };

  context.subscriptions.push(diagnostics);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refreshDocument),
    vscode.workspace.onDidChangeTextDocument((event) => refreshDocument(event.document)),
    vscode.workspace.onDidSaveTextDocument(refreshDocument),
    vscode.workspace.onDidCloseTextDocument(clearDocument),
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider("csvx", {
      provideHover(document, position) {
        const hover = languageService.getHover(
          document.getText(),
          { line: position.line + 1, column: position.character + 1 },
          document.uri.scheme === "file" ? document.uri.fsPath : undefined,
        );
        if (!hover) {
          return undefined;
        }

        return new vscode.Hover(
          hover.contents,
          new vscode.Range(
            new vscode.Position(hover.range.startLine - 1, hover.range.startColumn - 1),
            new vscode.Position(hover.range.endLine - 1, hover.range.endColumn),
          ),
        );
      },
    }),
    vscode.languages.registerDefinitionProvider("csvx", {
      provideDefinition(document, position) {
        const definition = languageService.getDefinition(
          document.getText(),
          { line: position.line + 1, column: position.character + 1 },
          document.uri.scheme === "file" ? document.uri.fsPath : undefined,
        );
        if (!definition) {
          return undefined;
        }

        const targetUri = definition.toPath
          ? vscode.Uri.file(path.resolve(definition.toPath))
          : document.uri;

        return new vscode.Location(
          targetUri,
          new vscode.Range(
            new vscode.Position(definition.toRange.startLine - 1, definition.toRange.startColumn - 1),
            new vscode.Position(definition.toRange.endLine - 1, definition.toRange.endColumn),
          ),
        );
      },
    }),
    vscode.languages.registerReferenceProvider("csvx", {
      provideReferences(document, position, context) {
        const references = languageService.getReferences(
          document.getText(),
          { line: position.line + 1, column: position.character + 1 },
          document.uri.scheme === "file" ? document.uri.fsPath : undefined,
          { includeDeclaration: context.includeDeclaration },
        );

        return references.map((reference) => {
          const targetUri = reference.path
            ? vscode.Uri.file(path.resolve(reference.path))
            : document.uri;
          return new vscode.Location(
            targetUri,
            new vscode.Range(
              new vscode.Position(reference.range.startLine - 1, reference.range.startColumn - 1),
              new vscode.Position(reference.range.endLine - 1, reference.range.endColumn),
            ),
          );
        });
      },
    }),
    vscode.languages.registerCompletionItemProvider(
      "csvx",
      {
        provideCompletionItems(document, position) {
          const completions = languageService.getCompletions(
            document.getText(),
            { line: position.line + 1, column: position.character + 1 },
            document.uri.scheme === "file" ? document.uri.fsPath : undefined,
          );

          return completions.map((item) => {
            const completionItem = new vscode.CompletionItem(item.label, toCompletionItemKind(item.kind));
            completionItem.detail = item.detail;
            if (item.insertText) {
              completionItem.insertText = item.insertText;
            }
            return completionItem;
          });
        },
      },
      "@",
      ":",
      ".",
    ),
  );

  vscode.workspace.textDocuments.forEach(refreshDocument);
}

function deactivate() {}

function toVscodeDiagnostic(issue) {
  const range = issue.range
    ? new vscode.Range(
        new vscode.Position(issue.range.startLine - 1, issue.range.startColumn - 1),
        new vscode.Position(issue.range.endLine - 1, issue.range.endColumn),
      )
    : new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

  const message = issue.suggestion
    ? `${issue.message}\nSuggestion: ${issue.suggestion}`
    : issue.message;

  const diagnostic = new vscode.Diagnostic(
    range,
    message,
    issue.severity === "error"
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning,
  );

  diagnostic.code = issue.code;
  diagnostic.source = "csvx";
  return diagnostic;
}

function toCompletionItemKind(kind) {
  switch (kind) {
    case "keyword":
      return vscode.CompletionItemKind.Keyword;
    case "property":
      return vscode.CompletionItemKind.Property;
    case "field":
      return vscode.CompletionItemKind.Field;
    case "function":
      return vscode.CompletionItemKind.Function;
    case "variable":
      return vscode.CompletionItemKind.Variable;
    case "module":
      return vscode.CompletionItemKind.Module;
    default:
      return vscode.CompletionItemKind.Text;
  }
}

module.exports = {
  activate,
  deactivate,
};
