import type { SourceRange, TableBlock } from "../types";
import type { DiagnosticRange } from "../../diagnostics";

export interface BlockBuffer {
  directive: string;
  name?: string;
  nameRange?: DiagnosticRange;
  headerLine: string;
  body: string[];
  source: SourceRange;
  bodyStartLine: number;
}

export interface ParserTableRegistry {
  [tableName: string]: TableBlock;
}
