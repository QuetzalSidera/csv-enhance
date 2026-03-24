declare function require(name: string): any;

import type { DiagnosticRange } from "../diagnostics";

const fs = require("fs");

export function findPluginExportDefinitions(modulePath: string): Map<string, DiagnosticRange> {
  const definitions = new Map<string, DiagnosticRange>();
  if (!fs.existsSync(modulePath)) {
    return definitions;
  }

  const source = fs.readFileSync(modulePath, "utf8");
  const patterns = [
    /export\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g,
  ];

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const name = match[1];
      const startOffset = match.index + match[0].lastIndexOf(name);
      const endOffset = startOffset + name.length;
      definitions.set(name, offsetRange(source, startOffset, endOffset));
    }
  });

  return definitions;
}

function offsetRange(source: string, startOffset: number, endOffset: number): DiagnosticRange {
  const start = offsetToLineColumn(source, startOffset);
  const end = offsetToLineColumn(source, endOffset);
  return {
    startLine: start.line,
    startColumn: start.column,
    startOffset,
    endLine: end.line,
    endColumn: end.column,
    endOffset,
  };
}

function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;

  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}
