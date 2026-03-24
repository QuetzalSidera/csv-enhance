import type { ComputeBlock, ComputeStatement } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import { IDENTIFIER_PATTERN } from "../parser-config";
import { ParserSupport } from "../parser-support";
import type { BlockBuffer } from "../block-buffer";

export class ComputeBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): ComputeBlock {
    const targets = this.support.parseComputeTargets(blockBuffer);
    const statements: ComputeStatement[] = [];

    blockBuffer.body.forEach((rawLine, offset) => {
      const line = rawLine.trim();
      if (this.support.shouldIgnoreLine(rawLine)) {
        return;
      }
      if (line.startsWith("target:")) {
        return;
      }

      const lineNumber = blockBuffer.bodyStartLine + offset;
      const separatorIndex = line.indexOf("=");
      if (separatorIndex < 1) {
        ThrowHelper.parser("invalid_compute_statement", { lineText: line }, { range: ThrowHelper.pointRange(lineNumber, 1) });
      }

      const target = line.slice(0, separatorIndex).trim();
      const expression = line.slice(separatorIndex + 1).trim();
      const targetColumn = rawLine.indexOf(target) + 1;
      const expressionColumn = rawLine.indexOf(expression, separatorIndex + 1) + 1;
      if (!IDENTIFIER_PATTERN.test(target)) {
        ThrowHelper.parser("invalid_compute_target", { target }, { range: ThrowHelper.lineFragmentRange(lineNumber, rawLine, target, targetColumn) });
      }

      statements.push({
        target,
        targetRange: ThrowHelper.lineFragmentRange(lineNumber, rawLine, target, targetColumn),
        expression,
        expressionRange: ThrowHelper.lineFragmentRange(lineNumber, rawLine, expression, expressionColumn),
        source: this.support.lineSource(blockBuffer, offset),
      });
    });

    return {
      kind: "compute",
      tableName: blockBuffer.name!,
      targets,
      statements,
      source: blockBuffer.source,
    };
  }
}
