import type { AnalyzedComputeBlock, AnalyzedFuncBlock, AnalyzedSheetBlock, AnalyzedSheetDocument, AnalyzedWindowBlock } from "../analysis/types";
import { BUILTIN_FUNCTION_NAMES } from "../expression";
import type { SheetFile, TableBlock, TableColumn } from "../file-interface/types";
import type { CompletionItem, EditorPosition } from "./types";

interface RawBlockContext {
  kind: string;
  name?: string;
  startLine: number;
}

type CompletionBlockContext = SheetFile["document"]["blocks"][number] | RawBlockContext;

const DIRECTIVE_ITEMS: CompletionItem[] = [
  { label: "@meta", kind: "keyword" },
  { label: "@plugin", kind: "keyword" },
  { label: "@table", kind: "keyword" },
  { label: "@func", kind: "keyword" },
  { label: "@compute", kind: "keyword" },
  { label: "@window", kind: "keyword" },
  { label: "@plot", kind: "keyword" },
];

const BLOCK_KEYWORDS: Record<string, CompletionItem[]> = {
  plugin: [
    { label: "path", kind: "property", insertText: "path: " },
    { label: "exports", kind: "property", insertText: "exports: " },
  ],
  compute: [
    { label: "target", kind: "property", insertText: "target: " },
  ],
  window: [
    { label: "target", kind: "property", insertText: "target: " },
    { label: "group", kind: "property", insertText: "group: " },
    { label: "order", kind: "property", insertText: "order: " },
  ],
  plot: [
    { label: "deps", kind: "property", insertText: "deps: " },
    { label: "x", kind: "property", insertText: "x: " },
    { label: "y", kind: "property", insertText: "y: " },
    { label: "color", kind: "property", insertText: "color: " },
    { label: "title", kind: "property", insertText: "title: " },
  ],
};

export function collectCompletions(
  source: string,
  position: EditorPosition,
  file?: SheetFile,
  analyzedDocument?: AnalyzedSheetDocument,
): CompletionItem[] {
  const lines = source.split("\n");
  const currentLine = lines[position.line - 1] ?? "";
  const linePrefix = currentLine.slice(0, Math.max(position.column - 1, 0));
  const rawScannedBlock = scanRawBlockContext(lines, position.line);
  const currentBlock: CompletionBlockContext | undefined =
    findRawBlockAtLine(file?.document.blocks ?? [], position.line) ?? rawScannedBlock;
  const analyzedBlock = findAnalyzedBlockAtLine(analyzedDocument?.blocks ?? [], position.line);

  if (/^\s*return\b/u.test(linePrefix) && rawScannedBlock?.kind === "func") {
    return filterByPrefix(buildRawFunctionBodyItems(lines, rawScannedBlock, position.line), currentToken(linePrefix));
  }

  if (linePrefix.includes("=") && rawScannedBlock && (rawScannedBlock.kind === "compute" || rawScannedBlock.kind === "window")) {
    return filterByPrefix(buildRawExpressionItems(lines, rawScannedBlock, position.line), currentToken(linePrefix));
  }

  if (/^\s*@[\p{L}\p{N}\p{M}_-]*$/u.test(linePrefix)) {
    const typedDirective = linePrefix.trim().slice(1);
    return filterByPrefix(DIRECTIVE_ITEMS, typedDirective, true);
  }

  if (!currentBlock) {
    return [];
  }

  if (supportsKeyCompletion(currentBlock.kind) && !linePrefix.includes(":") && !linePrefix.includes("=")) {
    return filterByPrefix(BLOCK_KEYWORDS[currentBlock.kind] ?? [], linePrefix.trim());
  }

  if (currentBlock.kind === "plot" && /(^\s*(deps|x|y|color)\s*:\s*)([\p{L}\p{N}\p{M}_-]*)$/u.test(linePrefix)) {
    return filterByPrefix(
      buildColumnItems(resolveAvailableColumns(resolveBlockTableName(currentBlock), position.line, file, analyzedDocument, source)),
      currentToken(linePrefix),
    );
  }

  if (currentBlock.kind === "window" && /(^\s*(group|order)\s*:\s*)([\p{L}\p{N}\p{M}_-]*)$/u.test(linePrefix)) {
    return filterByPrefix(
      buildColumnItems(resolveAvailableColumns(resolveBlockTableName(currentBlock), position.line, file, analyzedDocument, source)),
      currentToken(linePrefix),
    );
  }

  if ((analyzedBlock?.kind === "compute" || analyzedBlock?.kind === "window") && linePrefix.includes("=")) {
    return filterByPrefix(
      buildExpressionItems(analyzedBlock.tableName, position.line, file, analyzedDocument, analyzedBlock),
      currentToken(linePrefix),
    );
  }

  if (analyzedBlock?.kind === "func" && /\breturn\b/.test(linePrefix)) {
    return filterByPrefix(buildFunctionBodyItems(position.line, analyzedDocument, analyzedBlock), currentToken(linePrefix));
  }

  if ((currentBlock.kind === "compute" || currentBlock.kind === "window") && linePrefix.includes("=")) {
    return filterByPrefix(
      buildRawExpressionItems(lines, normalizeCompletionBlockContext(currentBlock), position.line),
      currentToken(linePrefix),
    );
  }

  if (currentBlock.kind === "func" && /\breturn\b/.test(linePrefix)) {
    return filterByPrefix(buildRawFunctionBodyItems(lines, normalizeCompletionBlockContext(currentBlock), position.line), currentToken(linePrefix));
  }

  return [];
}

function findRawBlockAtLine(blocks: SheetFile["document"]["blocks"], line: number): SheetFile["document"]["blocks"][number] | undefined {
  return blocks.find((block) => block.source.startLine <= line && block.source.endLine >= line);
}

function findAnalyzedBlockAtLine(blocks: AnalyzedSheetBlock[], line: number): AnalyzedSheetBlock | undefined {
  return blocks.find((block) => block.source.startLine <= line && block.source.endLine >= line);
}

function supportsKeyCompletion(kind: string): kind is keyof typeof BLOCK_KEYWORDS {
  return Object.prototype.hasOwnProperty.call(BLOCK_KEYWORDS, kind);
}

function resolveBlockTableName(block: CompletionBlockContext): string {
  if ("tableName" in block) {
    return block.tableName;
  }
  if ("name" in block) {
    return block.name ?? "";
  }
  return "";
}

function normalizeCompletionBlockContext(block: CompletionBlockContext): RawBlockContext {
  if ("startLine" in block) {
    return block;
  }

  if ("tableName" in block) {
    return {
      kind: block.kind,
      name: block.tableName,
      startLine: block.source.startLine,
    };
  }

  return {
    kind: block.kind,
    name: "name" in block ? block.name : undefined,
    startLine: block.source.startLine,
  };
}

function resolveAvailableColumns(
  tableName: string,
  line: number,
  file?: SheetFile,
  analyzedDocument?: AnalyzedSheetDocument,
  source?: string,
): TableColumn[] {
  const columns = new Map<string, TableColumn>();
  const tableBlock = file?.document.blocks.find((block): block is TableBlock => block.kind === "table" && block.name === tableName);
  tableBlock?.columns.forEach((column) => columns.set(column.name, column));

  analyzedDocument?.blocks.forEach((block) => {
    if ((block.kind === "compute" || block.kind === "window") && block.tableName === tableName && block.source.startLine < line) {
      block.outputColumns.forEach((column) => columns.set(column.name, column));
    }
  });

  if (columns.size === 0 && source) {
    collectRawColumns(source.split("\n"), tableName, line).forEach((column) => columns.set(column.name, column));
  }

  return [...columns.values()];
}

function buildColumnItems(columns: TableColumn[]): CompletionItem[] {
  return columns.map((column) => ({
    label: column.name,
    kind: "field",
    detail: `${column.name}[${column.columnType}]`,
  }));
}

function buildExpressionItems(
  tableName: string,
  line: number,
  file: SheetFile | undefined,
  analyzedDocument: AnalyzedSheetDocument | undefined,
  block: AnalyzedComputeBlock | AnalyzedWindowBlock,
): CompletionItem[] {
  const items = new Map<string, CompletionItem>();

  buildColumnItems(resolveAvailableColumns(tableName, line, file, analyzedDocument)).forEach((item) => items.set(item.label, item));
  BUILTIN_FUNCTION_NAMES.forEach((name) => {
    items.set(name, { label: name, kind: "function", detail: "builtin" });
  });
  analyzedDocument?.blocks.forEach((candidate) => {
    if (candidate.kind === "func") {
      items.set(candidate.name, { label: candidate.name, kind: "function", detail: "local @func" });
    }
  });
  file?.document.blocks.forEach((candidate) => {
    if (candidate.kind === "plugin") {
      candidate.exportNames.forEach((exportName) => {
        items.set(`${candidate.alias}.${exportName}`, {
          label: `${candidate.alias}.${exportName}`,
          kind: "module",
          detail: "plugin export",
        });
      });
    }
  });

  block.statements
    .filter((statement) => !statement.isOutput && statement.source.startLine < line)
    .forEach((statement) => {
      items.set(statement.target.columnName, {
        label: statement.target.columnName,
        kind: "variable",
        detail: `local ${statement.target.column.columnType}`,
      });
    });

  return [...items.values()];
}

function buildFunctionBodyItems(
  line: number,
  analyzedDocument: AnalyzedSheetDocument | undefined,
  block: AnalyzedFuncBlock,
): CompletionItem[] {
  const items = new Map<string, CompletionItem>();

  block.params.forEach((param) => {
    items.set(param.name, { label: param.name, kind: "variable", detail: `param ${param.type}` });
  });
  block.statements.forEach((statement) => {
    if (statement.kind === "assign" && statement.source.startLine < line) {
      items.set(statement.target.name, { label: statement.target.name, kind: "variable", detail: `local ${statement.target.type}` });
    }
  });
  BUILTIN_FUNCTION_NAMES.forEach((name) => {
    items.set(name, { label: name, kind: "function", detail: "builtin" });
  });
  analyzedDocument?.blocks.forEach((candidate) => {
    if (candidate.kind === "func") {
      items.set(candidate.name, { label: candidate.name, kind: "function", detail: "local @func" });
    }
  });

  return [...items.values()];
}

function currentToken(linePrefix: string): string {
  const match = linePrefix.match(/([\p{L}\p{N}\p{M}_.-]*)$/u);
  return match?.[1] ?? "";
}

function scanRawBlockContext(lines: string[], line: number): RawBlockContext | undefined {
  for (let index = line - 1; index >= 0; index -= 1) {
    const funcMatch = lines[index].match(/^\s*@func\s+([\p{L}_][\p{L}\p{N}\p{M}_]*)/u);
    if (funcMatch) {
      return {
        kind: "func",
        name: funcMatch[1],
        startLine: index + 1,
      };
    }

    const match = lines[index].match(/^\s*@([a-z]+)(?:\s+([\p{L}_][\p{L}\p{N}\p{M}_-]*))?\s*$/u);
    if (match) {
      return {
        kind: match[1],
        name: match[2],
        startLine: index + 1,
      };
    }
  }

  return undefined;
}

function buildRawExpressionItems(lines: string[], block: RawBlockContext, line: number): CompletionItem[] {
  const items = new Map<string, CompletionItem>();
  const tableName = block.name ?? "";

  collectRawColumns(lines, tableName, line).forEach((column) => {
    items.set(column.name, { label: column.name, kind: "field", detail: `${column.name}[${column.columnType}]` });
  });
  collectRawLocalNames(lines, block.startLine, line).forEach((name) => {
    items.set(name, { label: name, kind: "variable", detail: "local" });
  });
  collectRawFunctionNames(lines).forEach((name) => {
    items.set(name, { label: name, kind: "function", detail: "local @func" });
  });
  collectRawPluginCalls(lines).forEach((name) => {
    items.set(name, { label: name, kind: "module", detail: "plugin export" });
  });
  BUILTIN_FUNCTION_NAMES.forEach((name) => {
    items.set(name, { label: name, kind: "function", detail: "builtin" });
  });

  return [...items.values()];
}

function buildRawFunctionBodyItems(lines: string[], block: RawBlockContext, line: number): CompletionItem[] {
  const items = new Map<string, CompletionItem>();
  collectRawFunctionParams(lines[block.startLine - 1] ?? "").forEach((name) => {
    items.set(name, { label: name, kind: "variable", detail: "param" });
  });
  collectRawLocalNames(lines, block.startLine, line).forEach((name) => {
    items.set(name, { label: name, kind: "variable", detail: "local" });
  });
  collectRawFunctionNames(lines).forEach((name) => {
    items.set(name, { label: name, kind: "function", detail: "local @func" });
  });
  BUILTIN_FUNCTION_NAMES.forEach((name) => {
    items.set(name, { label: name, kind: "function", detail: "builtin" });
  });

  return [...items.values()];
}

function collectRawColumns(lines: string[], tableName: string, line: number): TableColumn[] {
  const columns = new Map<string, TableColumn>();

  for (let index = 0; index < lines.length; index += 1) {
    const headerMatch = lines[index].match(/^\s*@table\s+([\p{L}_][\p{L}\p{N}\p{M}_-]*)\s*$/u);
    if (!headerMatch || headerMatch[1] !== tableName) {
      continue;
    }

    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex].trim();
      if (row === "" || row.startsWith("#")) {
        continue;
      }
      if (row.startsWith("@")) {
        break;
      }
      row.split(",").map((cell) => cell.trim()).forEach((cell) => {
        const match = cell.match(/^([\p{L}_][\p{L}\p{N}\p{M}_]*)(?:\[(?:(row|col):)?(dynamic|string|number|boolean|null)\])?$/u);
        if (match) {
          columns.set(match[1], {
            name: match[1],
            declaredType: (match[3] ?? "dynamic") as TableColumn["declaredType"],
            columnType: (match[3] ?? "dynamic") as TableColumn["columnType"],
            isTypeExplicit: match[3] !== undefined,
          });
        }
      });
      break;
    }
  }

  for (let index = 0; index < Math.min(lines.length, line - 1); index += 1) {
    const blockMatch = lines[index].match(/^\s*@(compute|window)\s+([\p{L}_][\p{L}\p{N}\p{M}_-]*)\s*$/u);
    if (!blockMatch || blockMatch[2] !== tableName) {
      continue;
    }
    for (let rowIndex = index + 1; rowIndex < Math.min(lines.length, line - 1); rowIndex += 1) {
      const row = lines[rowIndex].trim();
      if (row.startsWith("target:")) {
        row.slice("target:".length).split(",").map((cell) => cell.trim()).forEach((cell) => {
          const match = cell.match(/^([\p{L}_][\p{L}\p{N}\p{M}_]*)(?:\[(?:(row|col):)?(dynamic|string|number|boolean|null)\])?$/u);
          if (match) {
            columns.set(match[1], {
              name: match[1],
              declaredType: (match[3] ?? "dynamic") as TableColumn["declaredType"],
              columnType: (match[3] ?? "dynamic") as TableColumn["columnType"],
              isTypeExplicit: match[3] !== undefined,
            });
          }
        });
      }
      if (row.startsWith("@")) {
        break;
      }
    }
  }

  return [...columns.values()];
}

function collectRawLocalNames(lines: string[], blockStartLine: number, line: number): string[] {
  const names = new Set<string>();
  for (let index = blockStartLine; index < Math.min(line - 1, lines.length); index += 1) {
    const match = lines[index].match(/^\s*([\p{L}_][\p{L}\p{N}\p{M}_]*)(?:\[(?:(row|col):)?(?:dynamic|string|number|boolean|null)\])?\s*=/u);
    if (match) {
      names.add(match[1]);
    }
  }
  return [...names.values()];
}

function collectRawFunctionNames(lines: string[]): string[] {
  return lines
    .map((line) => line.match(/^\s*@func\s+([\p{L}_][\p{L}\p{N}\p{M}_]*)/u)?.[1])
    .filter((name): name is string => Boolean(name));
}

function collectRawPluginCalls(lines: string[]): string[] {
  const calls: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const pluginMatch = lines[index].match(/^\s*@plugin\s+([\p{L}_][\p{L}\p{N}\p{M}_-]*)\s*$/u);
    if (!pluginMatch) {
      continue;
    }
    const alias = pluginMatch[1];
    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex].trim();
      if (row.startsWith("exports:")) {
        row.slice("exports:".length).split(",").map((cell) => cell.trim()).filter(Boolean).forEach((name) => {
          calls.push(`${alias}.${name}`);
        });
      }
      if (row.startsWith("@")) {
        break;
      }
    }
  }
  return calls;
}

function collectRawFunctionParams(signatureLine: string): string[] {
  const paramsMatch = signatureLine.match(/^\s*@func\s+[\p{L}_][\p{L}\p{N}\p{M}_]*\s*\((.*)\)\s*=>/u);
  if (!paramsMatch || paramsMatch[1].trim() === "") {
    return [];
  }

  return paramsMatch[1]
    .split(",")
    .map((value) => value.trim().match(/^([\p{L}_][\p{L}\p{N}\p{M}_]*)\[/u)?.[1])
    .filter((name): name is string => Boolean(name));
}

function filterByPrefix(items: CompletionItem[], prefix: string, stripAtPrefix = false): CompletionItem[] {
  const normalizedPrefix = prefix.trim();
  return items.filter((item) => {
    const candidate = stripAtPrefix ? item.label.slice(1) : item.label;
    return normalizedPrefix === "" || candidate.startsWith(normalizedPrefix);
  });
}
