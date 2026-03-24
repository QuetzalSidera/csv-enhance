import type { MetaBlock, MetaEntry } from "../../types";
import { ThrowHelper } from "../../../diagnostics";
import type { BlockBuffer } from "../block-buffer";
import { IDENTIFIER_PATTERN } from "../parser-config";
import { ParserSupport } from "../parser-support";

export class MetaBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): MetaBlock {
    const entries: MetaEntry[] = [];

    blockBuffer.body.forEach((rawLine, offset) => {
      const line = rawLine.trim();
      if (this.support.shouldIgnoreLine(rawLine)) {
        return;
      }

      const separatorIndex = line.indexOf(":");
      if (separatorIndex < 1) {
        ThrowHelper.parser("invalid_meta_entry", { lineText: line }, { range: ThrowHelper.pointRange(blockBuffer.bodyStartLine + offset, 1) });
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!IDENTIFIER_PATTERN.test(key)) {
        ThrowHelper.parser(
          "invalid_meta_key",
          { key },
          { range: ThrowHelper.lineFragmentRange(blockBuffer.bodyStartLine + offset, rawLine, key, rawLine.indexOf(key) + 1) },
        );
      }

      entries.push({
        key,
        value,
        source: this.support.lineSource(blockBuffer, offset),
      });
    });

    return {
      kind: "meta",
      entries,
      source: blockBuffer.source,
    };
  }
}
