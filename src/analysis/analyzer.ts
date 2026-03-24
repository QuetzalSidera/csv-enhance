import { ExpressionParser, inferBinaryOperatorType, inferBuiltinFunctionTypeWithRanges, inferUnaryOperatorType, isBuiltinFunction, type ParsedExpressionNode } from "../expression";
import { ThrowHelper, WarningCollector, WarningHelper } from "../diagnostics";
import type { DiagnosticRange } from "../diagnostics";
import type {
  AnalysisContext,
  AnalyzedComputeBlock,
  AnalyzedComputeStatement,
  AnalyzedFuncBlock,
  AnalyzedPlotBlock,
  AnalyzedSheetDocument,
  BuiltinCallNode,
  ColumnReferenceNode,
  ExpressionNode,
  FuncCallNode,
  LocalReferenceNode,
  PluginCallNode,
} from "./types";
import type { ColumnType, ComputeBlock, FuncBlock, PlotBlock, ResolvedPluginBlock, ResolvedSheetDocument, TableBlock, TableColumn } from "../file-interface/types";

export class SheetSemanticAnalyzer {
  analyze(document: ResolvedSheetDocument): AnalyzedSheetDocument {
    const warnings = new WarningCollector();
    const context = this.buildContext(document);

    return {
      blocks: document.blocks.map((block) => {
        if (block.kind === "func") {
          return context.funcMap[block.name];
        }

        if (block.kind === "compute") {
          return this.analyzeComputeBlock(block, context, warnings);
        }

        if (block.kind === "plot") {
          return this.analyzePlotBlock(block, context);
        }

        return block;
      }),
      warnings: warnings.list(),
    };
  }

  private buildContext(document: ResolvedSheetDocument): AnalysisContext {
    const tableMap: Record<string, TableBlock> = {};
    const rawFuncMap: Record<string, FuncBlock> = {};
    const funcMap: Record<string, AnalyzedFuncBlock> = {};
    const pluginMap: Record<string, ResolvedPluginBlock> = {};
    const computeOutputMap: Record<string, Record<string, TableColumn>> = {};

    for (const block of document.blocks) {
      if (block.kind === "table") {
        if (tableMap[block.name]) {
          ThrowHelper.analysis("duplicate_table_name", { name: block.name }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
        }
        tableMap[block.name] = block;
      }

      if (block.kind === "func") {
        if (isBuiltinFunction(block.name)) {
          ThrowHelper.analysis("builtin_function_name_reserved", { name: block.name }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
        }
        if (rawFuncMap[block.name]) {
          ThrowHelper.analysis("duplicate_function_name", { name: block.name }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
        }
        rawFuncMap[block.name] = block;
      }

      if (block.kind === "plugin") {
        if (pluginMap[block.alias]) {
          ThrowHelper.analysis("duplicate_plugin_alias", { name: block.alias }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
        }
        pluginMap[block.alias] = block;
      }

      if (block.kind === "compute") {
        const table = tableMap[block.tableName];
        if (!table) {
          ThrowHelper.analysis("unknown_compute_table", { table: block.tableName }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
        }

        const outputs: Record<string, TableColumn> = {};
        for (const targetColumn of block.targets.columns) {
          outputs[targetColumn.name] = {
            ...targetColumn,
          };
        }
        computeOutputMap[block.tableName] = outputs;
      }
    }

    const analyzeFuncByName = (name: string, stack: string[], range?: DiagnosticRange): AnalyzedFuncBlock => {
      const existing = funcMap[name];
      if (existing) {
        return existing;
      }

      const funcBlock = rawFuncMap[name];
      if (!funcBlock) {
        ThrowHelper.analysis("unknown_function", { name }, range ? { range } : {});
      }
      if (stack.includes(name)) {
        ThrowHelper.analysis("recursive_function_call", { path: [...stack, name].join(" -> ") }, { range: ThrowHelper.pointRange(funcBlock.source.startLine, 1) });
      }

      const localNames = new Set(funcBlock.params.map((param) => param.name));
      const localTypes: Record<string, ColumnType> = {};
      funcBlock.params.forEach((param) => {
        localTypes[param.name] = param.type;
      });
      const boundExpression = this.bindFunctionExpression(
        new ExpressionParser(funcBlock.expression, {
          line: funcBlock.expressionRange.startLine,
          column: funcBlock.expressionRange.startColumn,
        }).parse(),
        funcBlock,
        localNames,
        analyzeFuncByName,
        [...stack, name],
      );
      this.assertTypeAssignable(
        funcBlock.returnType,
        this.inferExpressionType(boundExpression, localTypes, new WarningCollector(), funcBlock.source.startLine),
        `@func ${funcBlock.name} return value`,
        funcBlock.expressionRange,
      );
      const analyzedFunc: AnalyzedFuncBlock = {
        kind: "func",
        name: funcBlock.name,
        params: funcBlock.params.map((param) => ({ ...param })),
        returnType: funcBlock.returnType,
        expression: boundExpression,
        source: funcBlock.source,
      };
      funcMap[name] = analyzedFunc;
      return analyzedFunc;
    };

    Object.keys(rawFuncMap).forEach((name) => {
      analyzeFuncByName(name, []);
    });

    return { document, tableMap, funcMap, pluginMap, computeOutputMap };
  }

  private analyzeComputeBlock(
    block: ComputeBlock,
    context: AnalysisContext,
    warnings: WarningCollector,
  ): AnalyzedComputeBlock {
    const table = context.tableMap[block.tableName];
    if (!table) {
      ThrowHelper.analysis("unknown_compute_table", { table: block.tableName }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
    }

    const localNames = new Set<string>();
    const outputs = block.targets.columns.map((column) => ({ columnName: column.name }));
    const outputSet = new Set(block.targets.columns.map((column) => column.name));

    for (const statement of block.statements) {
      if (!outputSet.has(statement.target)) {
        localNames.add(statement.target);
      }
    }

    const localTypes: Record<string, ColumnType> = {};
    const statements = block.statements.map((statement) => {
      const analyzedStatement = this.analyzeComputeStatement(statement, table, context, localNames);
      const expressionType = this.inferExpressionType(analyzedStatement.expression, localTypes, warnings, analyzedStatement.source.startLine);
      const outputColumn = block.targets.columns.find((column) => column.name === statement.target);

      if (outputColumn) {
        this.assertTypeAssignable(
          outputColumn.columnType,
          expressionType,
          `@compute ${table.name} target ${statement.target}`,
          statement.expressionRange,
        );
      } else {
        localTypes[statement.target] = expressionType;
      }

      return analyzedStatement;
    });

    return {
      kind: "compute",
      tableName: block.tableName,
      outputs,
      outputColumns: block.targets.columns.map((column) => ({ ...column })),
      locals: [...localNames],
      statements,
      source: block.source,
    };
  }

  private analyzeComputeStatement(
    statement: ComputeBlock["statements"][number],
    table: TableBlock,
    context: AnalysisContext,
    localNames: Set<string>,
  ): AnalyzedComputeStatement {
    const parsedExpression = new ExpressionParser(statement.expression, {
      line: statement.expressionRange.startLine,
      column: statement.expressionRange.startColumn,
    }).parse();

    return {
      target: {
        columnName: statement.target,
      },
      expression: this.bindExpression(parsedExpression, table, context, localNames),
      source: statement.source,
      isOutput: context.computeOutputMap[table.name][statement.target] !== undefined,
    };
  }

  private analyzePlotBlock(block: PlotBlock, context: AnalysisContext): AnalyzedPlotBlock {
    const table = context.tableMap[block.tableName];
    if (!table) {
      ThrowHelper.analysis("unknown_plot_table", { table: block.tableName }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
    }

    const availableColumns = this.buildAvailableColumns(table, context);
    const dependencyMap = new Map<string, TableColumn>();

    for (const dependencyName of block.dependencies.names) {
      const column = availableColumns[dependencyName];
      if (!column) {
        ThrowHelper.analysis(
            "unknown_plot_dependency",
            { dependency: dependencyName, table: block.tableName },
            block.dependencies.nameRanges?.[dependencyName]
              ? { range: block.dependencies.nameRanges[dependencyName] }
            : { range: ThrowHelper.pointRange(block.dependencies.source.startLine, 1) },
        );
      }
      dependencyMap.set(dependencyName, column);
    }

    this.assertPlotFieldDependency(block, "x", dependencyMap);
    this.assertPlotFieldDependency(block, "y", dependencyMap);
    this.assertPlotFieldDependency(block, "color", dependencyMap, false);

    const resolvedDependencies = block.dependencies.names.map((name) => {
      const column = dependencyMap.get(name);
      if (!column) {
        ThrowHelper.analysis(
            "unknown_plot_dependency",
            { dependency: name, table: block.tableName },
            block.dependencies.nameRanges?.[name]
              ? { range: block.dependencies.nameRanges[name] }
            : { range: ThrowHelper.pointRange(block.dependencies.source.startLine, 1) },
        );
      }
      return column;
    });

    return {
      ...block,
      resolvedDependencies,
    };
  }

  private bindExpression(
    expression: ParsedExpressionNode,
    table: TableBlock,
    context: AnalysisContext,
    localNames: Set<string>,
  ): ExpressionNode {
    switch (expression.kind) {
      case "number_literal":
        return expression;
      case "identifier":
        return this.resolveReference(expression.name, table, context, localNames, expression.range);
      case "unary_expression":
        return {
          kind: "unary_expression",
          operator: expression.operator,
          operand: this.bindExpression(expression.operand, table, context, localNames),
          range: expression.range,
        };
      case "binary_expression":
        return {
          kind: "binary_expression",
          operator: expression.operator,
          left: this.bindExpression(expression.left, table, context, localNames),
          right: this.bindExpression(expression.right, table, context, localNames),
          range: expression.range,
        };
      case "call_expression":
        return this.resolveCallExpression(expression, table, context, localNames);
    }
  }

  private resolveReference(
    name: string,
    table: TableBlock,
    context: AnalysisContext,
    localNames: Set<string>,
    range?: DiagnosticRange,
  ): ColumnReferenceNode | LocalReferenceNode {
    const column = table.columns.find((item) => item.name === name);
    if (column) {
      return {
        kind: "column_reference",
        column,
        range: range!,
      };
    }

    const outputColumn = context.computeOutputMap[table.name]?.[name];
    if (outputColumn) {
      return {
        kind: "column_reference",
        column: outputColumn,
        range: range!,
      };
    }

    if (localNames.has(name)) {
      return {
        kind: "local_reference",
        name,
        range: range!,
      };
    }

    ThrowHelper.analysis("unknown_reference", { name, table: table.name }, range ? { range } : {});
  }

  private resolveCallExpression(
    expression: Extract<ParsedExpressionNode, { kind: "call_expression" }>,
    table: TableBlock,
    context: AnalysisContext,
    localNames: Set<string>,
  ): BuiltinCallNode | FuncCallNode | PluginCallNode {
    const { callee, args, calleeRange } = expression;
    if (isBuiltinFunction(callee)) {
      return {
        kind: "builtin_call",
        name: callee,
        args: args.map((arg) => this.bindExpression(arg, table, context, localNames)),
        range: expression.range,
      };
    }

    const localFunction = context.funcMap[callee];
    if (localFunction) {
      if (args.length !== localFunction.params.length) {
        ThrowHelper.analysis(
          "function_arity_mismatch",
          { name: callee, expected: localFunction.params.length, actual: args.length },
          { range: calleeRange },
        );
      }

      return {
        kind: "func_call",
        functionName: callee,
        func: localFunction,
        args: args.map((arg) => this.bindExpression(arg, table, context, localNames)),
        range: expression.range,
      };
    }

    if (callee.indexOf(".") < 0) {
      ThrowHelper.analysis("unknown_function", { name: callee }, { range: calleeRange });
    }

    const [pluginAlias, exportName] = callee.split(".");
    if (!pluginAlias || !exportName || callee.split(".").length !== 2) {
      ThrowHelper.analysis("unsupported_function_call", { callee }, { range: calleeRange });
    }

    const pluginBlock = context.pluginMap[pluginAlias];
    if (!pluginBlock) {
      ThrowHelper.analysis("unknown_plugin_alias", { alias: pluginAlias }, { range: calleeRange });
    }

    const exportIndex = pluginBlock.exportNames.indexOf(exportName);
    if (exportIndex < 0) {
      ThrowHelper.analysis("unknown_plugin_export", { callee }, { range: calleeRange });
    }

    return {
      kind: "plugin_call",
      pluginAlias,
      exportName,
      fn: pluginBlock.binding.exports[exportIndex],
      args: args.map((arg) => this.bindExpression(arg, table, context, localNames)),
      range: expression.range,
    };
  }

  private bindFunctionExpression(
    expression: ParsedExpressionNode,
    funcBlock: FuncBlock,
    paramNames: Set<string>,
    analyzeFuncByName: (name: string, stack: string[], range?: DiagnosticRange) => AnalyzedFuncBlock,
    stack: string[],
  ): ExpressionNode {
    switch (expression.kind) {
      case "number_literal":
        return expression;
      case "identifier":
        if (!paramNames.has(expression.name)) {
          ThrowHelper.analysis(
            "unknown_function_parameter_reference",
            { name: expression.name, func: funcBlock.name },
            { range: expression.range },
          );
        }
        return {
          kind: "local_reference",
          name: expression.name,
          range: expression.range,
        };
      case "unary_expression":
        return {
          kind: "unary_expression",
          operator: expression.operator,
          operand: this.bindFunctionExpression(expression.operand, funcBlock, paramNames, analyzeFuncByName, stack),
          range: expression.range,
        };
      case "binary_expression":
        return {
          kind: "binary_expression",
          operator: expression.operator,
          left: this.bindFunctionExpression(expression.left, funcBlock, paramNames, analyzeFuncByName, stack),
          right: this.bindFunctionExpression(expression.right, funcBlock, paramNames, analyzeFuncByName, stack),
          range: expression.range,
        };
      case "call_expression": {
        if (isBuiltinFunction(expression.callee)) {
          return {
            kind: "builtin_call",
            name: expression.callee,
            args: expression.args.map((arg) =>
              this.bindFunctionExpression(arg, funcBlock, paramNames, analyzeFuncByName, stack),
            ),
            range: expression.range,
          };
        }

        const localFunction = analyzeFuncByName(expression.callee, stack, expression.calleeRange);
        if (expression.args.length !== localFunction.params.length) {
          ThrowHelper.analysis(
            "function_arity_mismatch",
            {
              name: expression.callee,
              expected: localFunction.params.length,
              actual: expression.args.length,
            },
            { range: expression.calleeRange },
          );
        }
        return {
          kind: "func_call",
          functionName: expression.callee,
          func: localFunction,
          args: expression.args.map((arg) =>
            this.bindFunctionExpression(arg, funcBlock, paramNames, analyzeFuncByName, stack),
          ),
          range: expression.range,
        };
      }
    }
  }

  private inferExpressionType(
    expression: ExpressionNode,
    localTypes: Record<string, ColumnType>,
    warnings: WarningCollector,
    line?: number,
  ): ColumnType {
    switch (expression.kind) {
      case "number_literal":
        return "number";
      case "column_reference":
        return expression.column.columnType;
      case "local_reference":
        return localTypes[expression.name] ?? "dynamic";
      case "unary_expression": {
        const operandType = this.inferExpressionType(expression.operand, localTypes, warnings, line);
        if (operandType === "dynamic") {
          warnings.add(
            WarningHelper.analysis(
              "number_compatible_required",
              { context: `Unary "${expression.operator}" operand`, actual: "dynamic" },
              { range: expression.operand.range, suggestion: "Declare the operand as number-compatible to avoid runtime type errors." },
            ),
          );
        }
        return inferUnaryOperatorType(expression.operator, operandType);
      }
      case "binary_expression": {
        const leftType = this.inferExpressionType(expression.left, localTypes, warnings, line);
        const rightType = this.inferExpressionType(expression.right, localTypes, warnings, line);
        if (leftType === "dynamic") {
          warnings.add(
            WarningHelper.analysis(
              "number_compatible_required",
              { context: `Left operand of "${expression.operator}"`, actual: "dynamic" },
              { range: expression.left.range, suggestion: "Declare the left operand as number-compatible to avoid runtime type errors." },
            ),
          );
        }
        if (rightType === "dynamic") {
          warnings.add(
            WarningHelper.analysis(
              "number_compatible_required",
              { context: `Right operand of "${expression.operator}"`, actual: "dynamic" },
              { range: expression.right.range, suggestion: "Declare the right operand as number-compatible to avoid runtime type errors." },
            ),
          );
        }
        return inferBinaryOperatorType(expression.operator, leftType, rightType);
      }
      case "builtin_call": {
        const argTypes = expression.args.map((arg) => this.inferExpressionType(arg, localTypes, warnings, line));
        if ((expression.name === "if" || expression.name === "and" || expression.name === "or") && argTypes.includes("dynamic")) {
          warnings.add(
            WarningHelper.analysis(
              "boolean_compatible_required",
              { context: `Arguments of ${expression.name}`, actual: "dynamic" },
              { range: expression.range, suggestion: "Use explicit boolean-typed inputs when calling boolean builtins." },
            ),
          );
        }
        return inferBuiltinFunctionTypeWithRanges(
          expression.name,
          expression.args.map((arg, index) => ({
            type: argTypes[index],
            range: arg.range,
          })),
          expression.range,
        );
      }
      case "func_call":
        return expression.func.returnType;
      case "plugin_call":
        if (expression.fn.__sheetReturnType && expression.fn.__sheetReturnType !== "dynamic") {
          return expression.fn.__sheetReturnType;
        }
        warnings.add(
          WarningHelper.analysis(
            "type_mismatch",
            { context: `Plugin call ${expression.pluginAlias}.${expression.exportName}`, expected: "known", actual: "dynamic" },
            { range: expression.range, suggestion: "Plugin return types are dynamic. Prefer explicit target types and validation." },
          ),
        );
        return "dynamic";
    }
  }

  private assertTypeAssignable(
    expectedType: ColumnType,
    actualType: ColumnType,
    context: string,
    range?: DiagnosticRange,
  ): void {
    if (expectedType === "dynamic" || actualType === "dynamic") {
      return;
    }

    if (expectedType !== actualType) {
      ThrowHelper.analysis("type_mismatch", { context, expected: expectedType, actual: actualType }, range ? { range } : {});
    }
  }

  private buildAvailableColumns(table: TableBlock, context: AnalysisContext): Record<string, TableColumn> {
    const availableColumns: Record<string, TableColumn> = {};

    for (const column of table.columns) {
      availableColumns[column.name] = column;
    }

    const computedOutputs = context.computeOutputMap[table.name] ?? {};
    for (const name of Object.keys(computedOutputs)) {
      availableColumns[name] = computedOutputs[name];
    }

    return availableColumns;
  }

  private assertPlotFieldDependency(
    block: PlotBlock,
    fieldName: "x" | "y" | "color",
    dependencyMap: Map<string, TableColumn>,
    required = true,
  ): void {
    const fieldValue = block.fields[fieldName];
    if (!fieldValue) {
      if (required) {
        ThrowHelper.analysis("plot_field_missing", { table: block.tableName, field: fieldName }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
      }
      return;
    }

    if (!dependencyMap.has(fieldValue)) {
      ThrowHelper.analysis(
        "plot_field_not_in_deps",
        { field: fieldName, value: fieldValue },
        block.fieldRanges?.[fieldName]
          ? { range: block.fieldRanges[fieldName] }
          : { range: ThrowHelper.pointRange(block.dependencies.source.startLine, 1) },
      );
    }
  }
}
