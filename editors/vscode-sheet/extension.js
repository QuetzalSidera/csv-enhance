"use strict";

const vscode = require("vscode");
const { SheetLinter } = require("./dist/lint/linter");

function activate(context) {
  const linter = new SheetLinter();
  const diagnostics = vscode.languages.createDiagnosticCollection("sheet");

  const refreshDocument = (document) => {
    if (!document || document.languageId !== "sheet") {
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
  diagnostic.source = "sheet";
  return diagnostic;
}

module.exports = {
  activate,
  deactivate,
};
