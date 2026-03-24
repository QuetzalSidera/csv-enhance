import type { FuncBlock, FuncStatement } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import { FUNC_DIRECTIVE_PATTERN, IDENTIFIER_PATTERN } from "../parser-config";
import { ParserSupport } from "../parser-support";
import type { BlockBuffer } from "../block-buffer";

export class FuncBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): FuncBlock {
    const signatureMatch = blockBuffer.headerLine.trim().match(FUNC_DIRECTIVE_PATTERN);
    if (!signatureMatch) {
      ThrowHelper.parser("invalid_func_signature", { signature: blockBuffer.headerLine.trim() }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    const statements: FuncStatement[] = [];

    blockBuffer.body.forEach((rawLine, offset) => {
      if (this.support.shouldIgnoreLine(rawLine)) {
        return;
      }

      const lineNumber = blockBuffer.bodyStartLine + offset;
      const lineStatements = this.support.splitSemicolonStatements(rawLine, lineNumber);
      lineStatements.forEach(({ value, range }) => {
        if (value.startsWith("return ")) {
          const expression = value.slice("return ".length).trim();
          if (expression === "") {
            ThrowHelper.parser("invalid_func_statement", { statement: value }, { range });
          }
          const expressionColumn = range.startColumn + value.indexOf(expression);
          statements.push({
            kind: "return",
            expression,
            expressionRange: ThrowHelper.lineFragmentRange(lineNumber, rawLine, expression, expressionColumn),
            source: { startLine: lineNumber, endLine: lineNumber },
          });
          return;
        }

        const separatorIndex = value.indexOf("=");
        if (separatorIndex < 1) {
          ThrowHelper.parser("invalid_func_statement", { statement: value }, { range });
        }

        const leftSide = value.slice(0, separatorIndex).trim();
        const rightSide = value.slice(separatorIndex + 1).trim();
        if (rightSide === "") {
          ThrowHelper.parser("invalid_func_statement", { statement: value }, { range });
        }

        const binding = leftSide.includes("[")
          ? this.support.parseFunctionValueBinding(leftSide, `@func ${signatureMatch[1]} locals`, "scalar", lineNumber, rawLine, value)
          : {
              name: leftSide,
              type: "dynamic" as const,
              shape: "scalar" as const,
            };

        if (!IDENTIFIER_PATTERN.test(binding.name)) {
          ThrowHelper.parser("invalid_identifier", { identifier: binding.name, context: `@func ${signatureMatch[1]} locals` }, { range });
        }

        const targetColumn = range.startColumn + value.indexOf(leftSide);
        const expressionColumn = range.startColumn + value.indexOf(rightSide);
        statements.push({
          kind: "assign",
          target: binding,
          targetRange: ThrowHelper.lineFragmentRange(lineNumber, rawLine, leftSide, targetColumn),
          expression: rightSide,
          expressionRange: ThrowHelper.lineFragmentRange(lineNumber, rawLine, rightSide, expressionColumn),
          source: { startLine: lineNumber, endLine: lineNumber },
        });
      });
    });

    if (statements.length === 0) {
      ThrowHelper.parser("func_body_expression_count", { name: signatureMatch[1] }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    if (!statements.some((statement) => statement.kind === "return")) {
      ThrowHelper.parser("func_return_required", { name: signatureMatch[1] }, { range: ThrowHelper.pointRange(blockBuffer.source.startLine, 1) });
    }

    return {
      kind: "func",
      name: signatureMatch[1],
      nameRange: blockBuffer.nameRange,
      params: this.support.parseFunctionParameters(
        signatureMatch[2],
        `@func ${signatureMatch[1]} parameters`,
        blockBuffer.source.startLine,
        blockBuffer.headerLine,
      ),
      returnSpec: this.support.parseFunctionReturnSpec(
        signatureMatch[3],
        signatureMatch[5],
        signatureMatch[4],
        blockBuffer.source.startLine,
        blockBuffer.headerLine,
      ),
      statements,
      source: blockBuffer.source,
    };
  }
}
