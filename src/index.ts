declare function require(name: string): any;

import { encodeWorkbook, writeWorkbookFile } from "./xlsx";

export interface MetaBlock {
  kind: "meta";
  entries: Record<string, string>;
}

export interface PluginBlock {
  kind: "plugin";
  alias: string;
  path: string;
  exports?: string[];
}

export interface TableBlock {
  kind: "table";
  name: string;
  header: string[];
  rows: string[][];
}

export interface ComputeStatement {
  target: string;
  expression: string;
}

export interface ComputeBlock {
  kind: "compute";
  table: string;
  statements: ComputeStatement[];
}

export interface PlotBlock {
  kind: "plot";
  table: string;
  spec: PlotDefinition;
}

export type SheetBlock = MetaBlock | PluginBlock | TableBlock | ComputeBlock | PlotBlock;

export interface SheetDocument {
  blocks: SheetBlock[];
}

export type CellValue = string | number | boolean | null;

export type ScalarValue = string | number | boolean | null;

export type ValueType = "string" | "number" | "boolean" | "null";

export interface TableRow {
  [column: string]: CellValue;
}

export interface TableData {
  name: string;
  columns: string[];
  rows: TableRow[];
  columnTypes: Record<string, ValueType>;
}

export interface PlotDefinition {
  type: string;
  x?: string;
  y?: string;
  color?: string;
  title?: string;
}

export interface VegaLiteSpec {
  $schema: string;
  title?: string;
  data: {
    values: TableRow[];
  };
  mark: string;
  encoding: Record<string, unknown>;
}

export type PluginFunction = (...args: ScalarValue[]) => ScalarValue;

export interface PluginModule {
  [name: string]: PluginFunction;
}

export interface PluginRegistry {
  [alias: string]: PluginModule;
}

export interface ExecutionOptions {
  baseDir?: string;
  plugins?: PluginRegistry;
}

export interface SheetExecutionResult {
  meta: Record<string, string>;
  tables: Record<string, TableData>;
  plots: Record<string, VegaLiteSpec[]>;
  plugins: PluginRegistry;
}

type ExpressionNode =
  | { kind: "number"; value: number }
  | { kind: "identifier"; name: string }
  | { kind: "unary"; operator: "-"; operand: ExpressionNode }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/"; left: ExpressionNode; right: ExpressionNode }
  | { kind: "call"; name: string; args: ExpressionNode[] };

interface EvaluationContext {
  row: TableRow;
  table: TableData;
  plugins: PluginRegistry;
}

interface Token {
  type: "number" | "identifier" | "operator" | "paren" | "comma" | "eof";
  value: string;
}

const DIRECTIVE_PATTERN = /^@([a-z]+)(?:\s+([A-Za-z_][A-Za-z0-9_-]*))?\s*$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const QUALIFIED_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/;
const SUPPORTED_PLOT_KEYS = new Set(["type", "x", "y", "color", "title"]);
const BUILTIN_FUNCTIONS = new Set(["sum", "avg", "min", "max"]);

export function parseSheet(source: string): SheetDocument {
  const lines = normalizeSource(source).split("\n");
  const blocks: SheetBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    if (isBlank(lines[index])) {
      index += 1;
      continue;
    }

    const headerMatch = lines[index].trim().match(DIRECTIVE_PATTERN);
    if (!headerMatch) {
      throw new Error(`Expected directive at line ${index + 1}: ${lines[index]}`);
    }

    const directive = headerMatch[1];
    const name = headerMatch[2];
    index += 1;

    const body: string[] = [];
    while (index < lines.length && !lines[index].replace(/^\s+/, "").startsWith("@")) {
      body.push(lines[index]);
      index += 1;
    }

    if (directive === "meta") {
      if (name) {
        throw new Error("@meta does not accept a block name");
      }
      blocks.push(parseMetaBlock(body));
      continue;
    }

    if (!name) {
      throw new Error(`@${directive} requires a block name`);
    }

    switch (directive) {
      case "plugin":
        blocks.push(parsePluginBlock(name, body));
        break;
      case "table":
        blocks.push(parseTableBlock(name, body));
        break;
      case "compute":
        blocks.push(parseComputeBlock(name, body));
        break;
      case "plot":
        blocks.push(parsePlotBlock(name, body));
        break;
      default:
        throw new Error(`Unsupported directive @${directive}`);
    }
  }

  return { blocks };
}

export function executeSheet(source: string, options: ExecutionOptions = {}): SheetExecutionResult {
  const document = parseSheet(source);
  const meta: Record<string, string> = {};
  const tables: Record<string, TableData> = {};
  const plots: Record<string, VegaLiteSpec[]> = {};
  const plugins: PluginRegistry = { ...(options.plugins ?? {}) };

  for (const block of document.blocks) {
    if (block.kind === "meta") {
      Object.assign(meta, block.entries);
      continue;
    }

    if (block.kind === "plugin") {
      plugins[block.alias] = loadPluginBlock(block, options.baseDir);
      continue;
    }

    if (block.kind === "table") {
      tables[block.name] = loadTable(block);
      continue;
    }

    if (block.kind === "compute") {
      const table = tables[block.table];
      if (!table) {
        throw new Error(`Unknown table for compute block: ${block.table}`);
      }
      applyComputeBlock(table, block, plugins);
      continue;
    }

    if (block.kind === "plot") {
      const table = tables[block.table];
      if (!table) {
        throw new Error(`Unknown table for plot block: ${block.table}`);
      }
      if (!plots[block.table]) {
        plots[block.table] = [];
      }
      plots[block.table].push(compilePlot(table, block.spec));
    }
  }

  return { meta, tables, plots, plugins };
}

export function compileSheetToXlsx(source: string, options: ExecutionOptions = {}): Uint8Array {
  const result = executeSheet(source, options);
  return encodeWorkbook(result.tables);
}

export function writeSheetXlsx(source: string, outputPath: string, options: ExecutionOptions = {}): void {
  const result = executeSheet(source, options);
  writeWorkbookFile(result.tables, outputPath);
}

export function compilePlot(table: TableData, definition: PlotDefinition): VegaLiteSpec {
  const mark = normalizeMark(definition.type);
  const encoding: Record<string, unknown> = {
    x: buildChannel(table, definition.x!),
    y: buildChannel(table, definition.y!),
  };

  if (definition.color) {
    encoding.color = buildChannel(table, definition.color);
  }

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    title: definition.title,
    data: {
      values: table.rows.map((row) => ({ ...row })),
    },
    mark,
    encoding,
  };
}

function parseMetaBlock(lines: string[]): MetaBlock {
  const entries: Record<string, string> = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`Invalid @meta entry at body line ${i + 1}: ${line}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!IDENTIFIER_PATTERN.test(key)) {
      throw new Error(`Invalid @meta key: ${key}`);
    }
    entries[key] = value;
  }

  return { kind: "meta", entries };
}

function parsePluginBlock(alias: string, lines: string[]): PluginBlock {
  const config = parseKeyValueBody(lines, "@plugin");
  if (!config.path) {
    throw new Error(`@plugin ${alias} requires a path`);
  }

  const exportsList = config.exports
    ? config.exports
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;

  if (exportsList) {
    for (const name of exportsList) {
      if (!IDENTIFIER_PATTERN.test(name)) {
        throw new Error(`Invalid plugin export name: ${name}`);
      }
    }
  }

  return {
    kind: "plugin",
    alias,
    path: config.path,
    exports: exportsList,
  };
}

function parseTableBlock(name: string, lines: string[]): TableBlock {
  const content = lines.filter((line) => !isBlank(line));
  if (content.length === 0) {
    throw new Error(`@table ${name} is empty`);
  }

  const header = parseCsvLine(content[0]);
  ensureUniqueIdentifiers(header, `@table ${name} header`);

  const rows = content.slice(1).map((line, index) => {
    const row = parseCsvLine(line);
    if (row.length !== header.length) {
      throw new Error(
        `@table ${name} row ${index + 2} has ${row.length} cells; expected ${header.length}`,
      );
    }
    return row;
  });

  return { kind: "table", name, header, rows };
}

function parseComputeBlock(table: string, lines: string[]): ComputeBlock {
  const statements: ComputeStatement[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid @compute statement at body line ${i + 1}: ${line}`);
    }
    const target = line.slice(0, separator).trim();
    const expression = line.slice(separator + 1).trim();
    if (!IDENTIFIER_PATTERN.test(target)) {
      throw new Error(`Invalid computed column name: ${target}`);
    }
    if (!expression) {
      throw new Error(`Missing expression for computed column ${target}`);
    }
    statements.push({ target, expression });
  }

  if (statements.length === 0) {
    throw new Error(`@compute ${table} is empty`);
  }

  return { kind: "compute", table, statements };
}

function parsePlotBlock(table: string, lines: string[]): PlotBlock {
  const content = lines.map((line) => line.trim()).filter(Boolean);
  if (content.length === 0) {
    throw new Error(`@plot ${table} is empty`);
  }

  let spec: PlotDefinition;

  if (content.length === 1 && !content[0].includes(":")) {
    const parts = content[0].split(/\s+/);
    if (parts.length < 3 || parts.length > 4) {
      throw new Error(`Invalid shorthand plot definition: ${content[0]}`);
    }
    spec = {
      type: parts[0],
      x: parts[1],
      y: parts[2],
      color: parts[3],
    };
  } else {
    const objectSpec = parseKeyValueBody(content, "@plot");
    spec = {
      type: objectSpec.type,
      x: objectSpec.x,
      y: objectSpec.y,
      color: objectSpec.color,
      title: objectSpec.title,
    };
  }

  if (!spec.type || !spec.x || !spec.y) {
    throw new Error(`Plot for table ${table} must define type, x, and y`);
  }

  return { kind: "plot", table, spec };
}

function parseKeyValueBody(lines: string[], context: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`Invalid ${context} entry: ${line}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (context === "@plot" && !SUPPORTED_PLOT_KEYS.has(key)) {
      throw new Error(`Unsupported plot key: ${key}`);
    }
    entries[key] = value;
  }

  return entries;
}

function loadTable(block: TableBlock): TableData {
  const rows = block.rows.map((values) => {
    const row: TableRow = {};
    for (let i = 0; i < block.header.length; i += 1) {
      row[block.header[i]] = inferCellValue(values[i]);
    }
    return row;
  });

  const columnTypes: Record<string, ValueType> = {};
  for (const column of block.header) {
    columnTypes[column] = inferColumnType(rows.map((row) => row[column]));
  }

  return {
    name: block.name,
    columns: [...block.header],
    rows,
    columnTypes,
  };
}

function applyComputeBlock(table: TableData, block: ComputeBlock, plugins: PluginRegistry): void {
  for (const statement of block.statements) {
    const expression = new ExpressionParser(statement.expression).parse();
    const values = table.rows.map((row) =>
      evaluateExpression(expression, {
        row,
        table,
        plugins,
      }),
    );

    for (let i = 0; i < table.rows.length; i += 1) {
      table.rows[i][statement.target] = values[i];
    }

    if (!table.columns.includes(statement.target)) {
      table.columns.push(statement.target);
    }
    table.columnTypes[statement.target] = inferColumnType(values);
  }
}

function buildChannel(table: TableData, field: string): Record<string, string> {
  if (!table.columns.includes(field)) {
    throw new Error(`Unknown plot field "${field}" for table ${table.name}`);
  }

  return {
    field,
    type: table.columnTypes[field] === "number" ? "quantitative" : "nominal",
  };
}

function normalizeMark(type: string): string {
  const normalized = type.trim().toLowerCase();
  const supported = new Set(["bar", "line", "point", "area"]);
  if (!supported.has(normalized)) {
    throw new Error(`Unsupported plot type: ${type}`);
  }
  return normalized;
}

function inferCellValue(raw: string): CellValue {
  const value = raw.trim();
  if (value === "") {
    return null;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

function inferColumnType(values: CellValue[]): ValueType {
  const nonNull = values.filter((value) => value !== null);
  if (nonNull.length === 0) {
    return "null";
  }
  if (nonNull.every((value) => typeof value === "number")) {
    return "number";
  }
  if (nonNull.every((value) => typeof value === "boolean")) {
    return "boolean";
  }
  return "string";
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error(`Unterminated quoted value in CSV line: ${line}`);
  }

  cells.push(current.trim());
  return cells;
}

function ensureUniqueIdentifiers(values: string[], context: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!IDENTIFIER_PATTERN.test(value)) {
      throw new Error(`Invalid identifier "${value}" in ${context}`);
    }
    if (seen.has(value)) {
      throw new Error(`Duplicate identifier "${value}" in ${context}`);
    }
    seen.add(value);
  }
}

function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, "\n").trim();
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

class ExpressionParser {
  private readonly tokens: Token[];

  private index = 0;

  constructor(source: string) {
    this.tokens = tokenizeExpression(source);
  }

  parse(): ExpressionNode {
    const expression = this.parseExpression();
    this.expect("eof");
    return expression;
  }

  private parseExpression(): ExpressionNode {
    let node = this.parseTerm();
    while (this.match("operator", "+") || this.match("operator", "-")) {
      const operator = this.consume().value as "+" | "-";
      const right = this.parseTerm();
      node = { kind: "binary", operator, left: node, right };
    }
    return node;
  }

  private parseTerm(): ExpressionNode {
    let node = this.parseFactor();
    while (this.match("operator", "*") || this.match("operator", "/")) {
      const operator = this.consume().value as "*" | "/";
      const right = this.parseFactor();
      node = { kind: "binary", operator, left: node, right };
    }
    return node;
  }

  private parseFactor(): ExpressionNode {
    if (this.match("operator", "-")) {
      this.consume();
      return { kind: "unary", operator: "-", operand: this.parseFactor() };
    }

    if (this.match("paren", "(")) {
      this.consume();
      const expression = this.parseExpression();
      this.expect("paren", ")");
      return expression;
    }

    if (this.match("number")) {
      return { kind: "number", value: Number(this.consume().value) };
    }

    if (this.match("identifier")) {
      const token = this.consume();
      if (this.match("paren", "(")) {
        this.consume();
        const args: ExpressionNode[] = [];
        if (!this.match("paren", ")")) {
          do {
            args.push(this.parseExpression());
          } while (this.match("comma") && this.consume());
        }
        this.expect("paren", ")");
        if (!QUALIFIED_NAME_PATTERN.test(token.value)) {
          throw new Error(`Invalid function name: ${token.value}`);
        }
        return { kind: "call", name: token.value, args };
      }

      if (token.value.includes(".")) {
        throw new Error(`Only function calls may use dotted names: ${token.value}`);
      }
      return { kind: "identifier", name: token.value };
    }

    throw new Error(`Unexpected token in expression: ${this.peek().value}`);
  }

  private match(type: Token["type"], value?: string): boolean {
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  private expect(type: Token["type"], value?: string): Token {
    const token = this.peek();
    if (!this.match(type, value)) {
      throw new Error(`Expected ${value ?? type} but found ${token.value}`);
    }
    return this.consume();
  }

  private consume(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private peek(): Token {
    return this.tokens[this.index];
  }
}

function tokenizeExpression(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[0-9.]/.test(source[end])) {
        end += 1;
      }
      const value = source.slice(index, end);
      if (!/^\d+(?:\.\d+)?$/.test(value)) {
        throw new Error(`Invalid numeric literal: ${value}`);
      }
      tokens.push({ type: "number", value });
      index = end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_.]/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: "identifier", value: source.slice(index, end) });
      index = end;
      continue;
    }

    if ("+-*/".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if ("()".includes(char)) {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character in expression: ${char}`);
  }

  tokens.push({ type: "eof", value: "<eof>" });
  return tokens;
}

function evaluateExpression(node: ExpressionNode, context: EvaluationContext): CellValue {
  switch (node.kind) {
    case "number":
      return node.value;
    case "identifier":
      if (!(node.name in context.row)) {
        throw new Error(`Unknown column in expression: ${node.name}`);
      }
      return context.row[node.name];
    case "unary":
      return -toNumber(evaluateExpression(node.operand, context));
    case "binary":
      return applyBinaryOperator(
        node.operator,
        toNumber(evaluateExpression(node.left, context)),
        toNumber(evaluateExpression(node.right, context)),
      );
    case "call":
      return evaluateFunction(node, context);
  }
}

function evaluateFunction(node: Extract<ExpressionNode, { kind: "call" }>, context: EvaluationContext): CellValue {
  const args = node.args.map((arg) => evaluateExpression(arg, context));
  if (BUILTIN_FUNCTIONS.has(node.name)) {
    return evaluateBuiltinFunction(node.name, node.args, context);
  }

  const parts = node.name.split(".");
  if (parts.length !== 2) {
    throw new Error(`Unknown function: ${node.name}`);
  }

  const plugin = context.plugins[parts[0]];
  if (!plugin) {
    throw new Error(`Unknown plugin alias: ${parts[0]}`);
  }

  const fn = plugin[parts[1]];
  if (typeof fn !== "function") {
    throw new Error(`Unknown plugin function: ${node.name}`);
  }

  const result = fn(...args);
  validatePluginReturnValue(node.name, result);
  return result;
}

function evaluateBuiltinFunction(
  name: string,
  args: ExpressionNode[],
  context: EvaluationContext,
): CellValue {
  if (args.length !== 1) {
    throw new Error(`Function ${name} expects exactly one argument`);
  }

  const values = context.table.rows.map((row) =>
    toNumber(
      evaluateExpression(args[0], {
        row,
        table: context.table,
        plugins: context.plugins,
      }),
    ),
  );

  if (values.length === 0) {
    return 0;
  }

  switch (name) {
    case "sum":
      return values.reduce((total, value) => total + value, 0);
    case "avg":
      return values.reduce((total, value) => total + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      throw new Error(`Unsupported function: ${name}`);
  }
}

function toNumber(value: CellValue): number {
  if (typeof value === "number") {
    return value;
  }
  throw new Error(`Expected numeric value but received ${String(value)}`);
}

function applyBinaryOperator(operator: "+" | "-" | "*" | "/", left: number, right: number): number {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0) {
        throw new Error("Division by zero");
      }
      return left / right;
  }
}

function validatePluginReturnValue(name: string, value: unknown): void {
  const valid =
    value === null ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean";
  if (!valid) {
    throw new Error(`Plugin function ${name} must return number, string, boolean, or null`);
  }
}

function loadPluginBlock(block: PluginBlock, baseDir = process.cwd()): PluginModule {
  const path = require("path");
  const resolvedPath = path.resolve(baseDir, block.path);
  const loaded = loadPluginModuleFromFile(resolvedPath);
  const exportedNames = block.exports ?? Object.keys(loaded);
  const moduleRecord: PluginModule = {};

  for (const name of exportedNames) {
    const value = loaded[name];
    if (typeof value !== "function") {
      throw new Error(`Plugin export ${name} in ${resolvedPath} is not a function`);
    }
    moduleRecord[name] = value;
  }

  return moduleRecord;
}

function loadPluginModuleFromFile(filePath: string): Record<string, unknown> {
  const fs = require("fs");
  const path = require("path");
  const vm = require("vm");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".js" || extension === ".cjs") {
    return require(filePath);
  }

  if (extension !== ".ts") {
    throw new Error(`Unsupported plugin module extension: ${extension}`);
  }

  const ts = require("typescript");
  const source = fs.readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
    fileName: filePath,
  });

  const module = { exports: {} as Record<string, unknown> };
  const dirname = path.dirname(filePath);
  const localRequire = (request: string): unknown => {
    if (!request.startsWith(".") && !request.startsWith("/")) {
      throw new Error(`Plugin imports must be local paths: ${request}`);
    }
    const target = path.resolve(dirname, request);
    return loadPluginModuleFromFile(target);
  };

  const script = new vm.Script(transpiled.outputText, { filename: filePath });
  script.runInNewContext({
    module,
    exports: module.exports,
    require: localRequire,
    __filename: filePath,
    __dirname: dirname,
  });

  return module.exports;
}

const process = require("process");

export const exampleSheet = `@meta
title: Plugin-aware sales workbook
author: Codex

@plugin plugin
path: ./examples/plugins/finance.ts
exports: tax, bucket

@table sales
item,price,qty
apple,3,5
banana,2,10
orange,4,6

@compute sales
revenue = price * qty
taxed_revenue = plugin.tax(price, qty)
size_bucket = plugin.bucket(qty)
avg_qty = avg(qty)

@plot sales
bar item taxed_revenue`;
