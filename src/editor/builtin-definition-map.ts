declare function require(name: string): any;
declare const __dirname: string;

import type { BuiltinFunctionName } from "../expression";
import type { DiagnosticRange } from "../diagnostics";

const fs = require("fs");
const path = require("path");

interface BuiltinDefinition {
  path: string;
  range: DiagnosticRange;
  detail: string;
}

const BUILTIN_DETAILS: Record<BuiltinFunctionName, string> = {
  if: "builtin if(condition, thenValue, elseValue)",
  coalesce: "builtin coalesce(value, fallback, ...)",
  and: "builtin and(a, b, ...)",
  or: "builtin or(a, b, ...)",
  current: "builtin current(column)",
  lag: "builtin lag(column, offset?)",
  lead: "builtin lead(column, offset?)",
  first: "builtin first(column)",
  last: "builtin last(column)",
  row_number: "builtin row_number()",
  rank: "builtin rank()",
  cumsum: "builtin cumsum(column)",
};

export function findBuiltinDefinition(name: BuiltinFunctionName): BuiltinDefinition | undefined {
  const docPath = resolveBuiltinDocPath();
  if (!docPath) {
    return undefined;
  }
  const definitionRanges = findBuiltinHeadingRanges(docPath);
  const range = definitionRanges.get(name);
  if (!range) {
    return undefined;
  }

  return {
    path: docPath,
    range,
    detail: BUILTIN_DETAILS[name],
  };
}

function resolveBuiltinDocPath(): string | undefined {
  const candidates = [
    path.resolve(__dirname, "../../docs/BUILTINS.en.md"),
    path.resolve(__dirname, "../../BUILTINS.en.md"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function findBuiltinHeadingRanges(docPath: string): Map<string, DiagnosticRange> {
  const definitions = new Map<string, DiagnosticRange>();
  if (!fs.existsSync(docPath)) {
    return definitions;
  }

  // Builtin definitions are anchored to Markdown headings so editor jumps stay stable
  // even when the descriptive text under each heading changes.
  const source = fs.readFileSync(docPath, "utf8");
  const lines = source.split("\n");
  let offset = 0;

  lines.forEach((line: string, index: number) => {
    const match = line.match(/^##\s+`([^`]+)`/);
    if (!match) {
      offset += line.length + 1;
      return;
    }

    const name = match[1];
    const startColumn = line.indexOf(name) + 1;
    definitions.set(name, {
      startLine: index + 1,
      startColumn,
      startOffset: offset + startColumn - 1,
      endLine: index + 1,
      endColumn: startColumn + name.length - 1,
      endOffset: offset + startColumn + name.length - 2,
    });
    offset += line.length + 1;
  });

  return definitions;
}
