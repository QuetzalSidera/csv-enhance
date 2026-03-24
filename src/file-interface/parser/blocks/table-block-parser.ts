import type { TableBlock } from "../../types";
import type { BlockBuffer } from "../block-buffer";
import { ParserSupport } from "../parser-support";

export class TableBlockParser {
  constructor(private readonly support: ParserSupport) {}

  parse(blockBuffer: BlockBuffer): TableBlock {
    const content = this.support.parseTableBlockContent(blockBuffer);

    return {
      kind: "table",
      name: blockBuffer.name!,
      nameRange: blockBuffer.nameRange,
      columns: content.columns,
      rows: content.rows,
      source: blockBuffer.source,
    };
  }
}
