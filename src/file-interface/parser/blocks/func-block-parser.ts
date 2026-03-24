import type { ColumnType, FuncBlock } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import { FUNC_DIRECTIVE_PATTERN } from "../parser-config";
import { ParserSupport } from "../parser-support";
import type { BlockBuffer } from "../block-buffer";

export class FuncBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): FuncBlock {
    const signatureMatch = blockBuffer.headerLine.trim().match(FUNC_DIRECTIVE_PATTERN);
    if (!signatureMatch) {
      ThrowHelper.parser("invalid_func_signature", { signature: blockBuffer.headerLine.trim() }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    const expressionLines = blockBuffer.body
      .map((line, offset) => ({ rawLine: line, offset }))
      .filter((entry) => !this.support.shouldIgnoreLine(entry.rawLine))
      .map((entry) => ({ ...entry, expression: entry.rawLine.trim() }));
    if (expressionLines.length !== 1) {
      ThrowHelper.parser("func_body_expression_count", { name: signatureMatch[1] }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    const expressionLine = expressionLines[0];
    const expressionLineNumber = blockBuffer.bodyStartLine + expressionLine.offset;
    const expressionColumn = expressionLine.rawLine.indexOf(expressionLine.expression) + 1;

    return {
      kind: "func",
      name: signatureMatch[1],
      params: this.support.parseFunctionParameters(
        signatureMatch[2],
        `@func ${signatureMatch[1]} parameters`,
        blockBuffer.source.startLine,
        blockBuffer.headerLine,
      ),
      returnType: signatureMatch[3] as ColumnType,
      expression: expressionLine.expression,
      expressionRange: ThrowHelper.lineFragmentRange(
        expressionLineNumber,
        expressionLine.rawLine,
        expressionLine.expression,
        expressionColumn,
      ),
      source: blockBuffer.source,
    };
  }
}
