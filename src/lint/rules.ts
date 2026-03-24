import { ThrowHelper } from "../diagnostics";
import type { AnalyzedComputeBlock, AnalyzedFuncBlock } from "../analysis/types";
import type { LintIssue, LintRule, LintRuleContext } from "./types";
import { collectExpressionReferences } from "./types";

function createLintWarning(
  code: string,
  message: string,
  range?: import("../diagnostics").DiagnosticRange,
  suggestion?: string,
): LintIssue {
  return {
    code,
    phase: "lint",
    severity: "warning",
    message,
    range,
    suggestion,
  };
}

function getFunctionUsage(context: LintRuleContext): Set<string> {
  const usedFunctionNames = new Set<string>();

  context.analyzedDocument.blocks.forEach((block) => {
    switch (block.kind) {
      case "compute":
        block.statements.forEach((statement) => {
          collectExpressionReferences(statement.expression, { localNames: new Set(), functionNames: usedFunctionNames });
        });
        break;
      case "func":
        block.statements.forEach((statement) => {
          collectExpressionReferences(statement.expression, { localNames: new Set(), functionNames: usedFunctionNames });
        });
        break;
      default:
        break;
    }
  });

  return usedFunctionNames;
}

function buildUnusedLocalsIssues(block: AnalyzedComputeBlock): LintIssue[] {
  const usedLocals = new Set<string>();
  block.statements.forEach((statement) => {
    collectExpressionReferences(statement.expression, { localNames: usedLocals, functionNames: new Set() });
  });

  return block.locals
    .filter((localName) => !usedLocals.has(localName))
    .map((localName) => {
      const statement = block.statements.find((entry) => entry.target.columnName === localName);
      return createLintWarning(
        "LINT_UNUSED_LOCAL",
        `Local variable "${localName}" is never used.`,
        statement ? ThrowHelper.pointRange(statement.source.startLine, 1) : undefined,
        `Remove "${localName}" or reference it from a later expression.`,
      );
    });
}

export const unusedLocalRule: LintRule = {
  id: "unused-local",
  run(context) {
    const issues: LintIssue[] = [];
    context.analyzedDocument.blocks.forEach((block: import("../analysis/types").AnalyzedSheetBlock) => {
      if (block.kind === "compute") {
        issues.push(...buildUnusedLocalsIssues(block));
      }
    });
    return issues;
  },
};

export const unusedFuncRule: LintRule = {
  id: "unused-func",
  run(context) {
    const usedFunctionNames = getFunctionUsage(context);

    return context.analyzedDocument.blocks
      .filter((block): block is AnalyzedFuncBlock => block.kind === "func")
      .filter((block) => !usedFunctionNames.has(block.name))
      .map((block) =>
        createLintWarning(
          "LINT_UNUSED_FUNC",
          `Function "${block.name}" is never called.`,
          ThrowHelper.pointRange(block.source.startLine, 1),
          `Remove @func ${block.name} or call it from @compute.`,
        ),
      );
  },
};

export const redundantPlotDependencyRule: LintRule = {
  id: "redundant-plot-dependency",
  run(context) {
    const issues: LintIssue[] = [];
    context.analyzedDocument.blocks.forEach((block: import("../analysis/types").AnalyzedSheetBlock) => {
      if (block.kind !== "plot") {
        return;
      }

      const usedFields = new Set([block.fields.x, block.fields.y, block.fields.color].filter(Boolean));
      block.dependencies.names
        .filter((dependencyName: string) => !usedFields.has(dependencyName))
        .forEach((dependencyName: string) => {
          issues.push(
            createLintWarning(
            "LINT_REDUNDANT_PLOT_DEPENDENCY",
            `Plot dependency "${dependencyName}" is declared but not used by x, y, or color.`,
            block.dependencies.nameRanges?.[dependencyName],
            `Remove "${dependencyName}" from deps or bind it to a plot field.`,
            ),
          );
        });
    });
    return issues;
  },
};

export const DEFAULT_LINT_RULES: LintRule[] = [
  unusedLocalRule,
  unusedFuncRule,
  redundantPlotDependencyRule,
];
