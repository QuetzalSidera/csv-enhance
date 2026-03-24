import { SheetSemanticAnalyzer } from "../analysis/analyzer";
import { SheetDiagnosticError } from "../diagnostics";
import { DefaultSheetFileReader, type SheetFileReader } from "../file-interface/reader";
import { SheetLinter } from "../lint/linter";
import type {
  CompletionItem,
  DefinitionInfo,
  EditorPosition,
  HoverInfo,
  LanguageServiceResult,
  ReferenceInfo,
} from "./types";
import { collectCompletions } from "./completion";
import { collectSymbols } from "./symbol-collector";
import { collectReferences, findSymbolAtPosition, toDefinitionInfo, toHoverInfo } from "./symbol-query";

export class SheetLanguageService {
  constructor(
    private readonly reader: SheetFileReader = new DefaultSheetFileReader(),
    private readonly analyzer: SheetSemanticAnalyzer = new SheetSemanticAnalyzer(),
    private readonly linter: SheetLinter = new SheetLinter(reader, analyzer),
  ) {}

  analyzeSource(source: string, path?: string): LanguageServiceResult {
    const lintResult = this.linter.lintSource(source, path);

    try {
      const file = this.reader.readFromString(source, path);
      const analyzedDocument = this.analyzer.analyze(file.document);
      return {
        file,
        analyzedDocument,
        lintResult,
        issues: lintResult.issues,
        symbols: collectSymbols(file, analyzedDocument),
      };
    } catch (error) {
      if (error instanceof SheetDiagnosticError) {
        return {
          lintResult,
          issues: lintResult.issues,
          symbols: [],
        };
      }

      throw error;
    }
  }

  getDefinition(source: string, position: EditorPosition, path?: string): DefinitionInfo | undefined {
    const result = this.analyzeSource(source, path);
    const symbol = findSymbolAtPosition(result.symbols, position);
    return symbol ? toDefinitionInfo(symbol) : undefined;
  }

  getHover(source: string, position: EditorPosition, path?: string): HoverInfo | undefined {
    const result = this.analyzeSource(source, path);
    const symbol = findSymbolAtPosition(result.symbols, position);
    return symbol ? toHoverInfo(symbol) : undefined;
  }

  getReferences(
    source: string,
    position: EditorPosition,
    path?: string,
    options: { includeDeclaration?: boolean } = {},
  ): ReferenceInfo[] {
    const result = this.analyzeSource(source, path);
    const symbol = findSymbolAtPosition(result.symbols, position);
    return symbol ? collectReferences(result.symbols, symbol, path, options) : [];
  }

  getCompletions(source: string, position: EditorPosition, path?: string): CompletionItem[] {
    const result = this.analyzeSource(source, path);
    return collectCompletions(source, position, result.file, result.analyzedDocument);
  }
}
