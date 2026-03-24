declare function require(name: string): any;

import { ThrowHelper } from "../diagnostics";
import { PluginModuleLoader } from "./plugin-loader";
import { SheetSyntaxParser } from "./parser";
import type {
  ParsedPluginBlock,
  ParsedSheetBlock,
  ParsedSheetDocument,
  ResolvedPluginBlock,
  ResolvedSheetBlock,
  ResolvedSheetDocument,
  SheetFile,
} from "./types";

const fs = require("fs");
const path = require("path");

export interface SheetFileReader {
  readFromString(source: string, path?: string): SheetFile;
  readFromPath(path: string): SheetFile;
}

export class DefaultSheetFileReader implements SheetFileReader {
  // The reader stays thin and delegates all syntax work to the parser.
  constructor(
    private readonly parser: SheetSyntaxParser = new SheetSyntaxParser(),
    private readonly pluginLoader: PluginModuleLoader = new PluginModuleLoader(),
  ) {}

  readFromString(source: string, path?: string): SheetFile {
    const document = this.resolveDocumentPlugins(this.parser.parse(source), path);
    return {
      path,
      source,
      document,
    };
  }

  readFromPath(path: string): SheetFile {
    const source = fs.readFileSync(path, "utf8");
    return this.readFromString(source, path);
  }

  private resolveDocumentPlugins(document: ParsedSheetDocument, filePath?: string): ResolvedSheetDocument {
    if (!filePath) {
      return {
        blocks: document.blocks.map((block) => this.loadPluginBlock(block)),
      };
    }

    const baseDirectory = path.dirname(filePath);
    return {
      blocks: document.blocks.map((block) => this.loadPluginBlock(block, baseDirectory)),
    };
  }

  private loadPluginBlock(block: ParsedSheetBlock, baseDirectory?: string): ResolvedSheetBlock {
    if (block.kind !== "plugin") {
      return block;
    }

    return this.resolvePluginBinding(block, baseDirectory);
  }

  private resolvePluginBinding(block: ParsedPluginBlock, baseDirectory?: string): ResolvedPluginBlock {
    const resolvedModulePath = this.resolveModulePath(block.binding.path, baseDirectory);

    return {
      kind: "plugin",
      alias: block.alias,
      source: block.source,
      modulePath: resolvedModulePath,
      exportNames: [...block.binding.exportNames],
      binding: { exports: this.pluginLoader.load(resolvedModulePath, block.binding.exportNames) },
    };
  }

  private resolveModulePath(modulePath: string, baseDirectory?: string): string {
    if (path.isAbsolute(modulePath)) {
      return modulePath;
    }

    if (!baseDirectory) {
      ThrowHelper.runtime("relative_plugin_path_requires_file", { modulePath });
    }

    return path.resolve(baseDirectory, modulePath);
  }
}
