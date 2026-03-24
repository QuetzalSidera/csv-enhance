import type { SourceRange, TableBlock } from "../types";

export interface BlockBuffer {
  directive: string;
  name?: string;
  headerLine: string;
  body: string[];
  source: SourceRange;
  bodyStartLine: number;
}

export interface ParserTableRegistry {
  [tableName: string]: TableBlock;
}
