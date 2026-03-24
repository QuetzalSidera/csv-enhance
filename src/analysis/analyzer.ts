import { ExpressionParser, inferBinaryOperatorType, inferBuiltinFunctionTypeWithRanges, inferUnaryOperatorType, isBuiltinFunction, isKnownBuiltinFunction, type ParsedExpressionNode } from "../expression";
import { ThrowHelper, WarningCollector, WarningHelper } from "../diagnostics";
import type { DiagnosticRange } from "../diagnostics";
import type {
  AnalysisContext,
  AnalyzedComputeBlock,
  AnalyzedComputeStatement,
  AnalyzedFuncAssignmentStatement,
  AnalyzedFuncBlock,
  AnalyzedFuncReturnStatement,
  AnalyzedPlotBlock,
  AnalyzedSheetDocument,
  AnalyzedWindowBlock,
  BuiltinCallNode,
  ColumnReferenceNode,
  ExpressionNode,
  FuncCallNode,
  LocalReferenceNode,
  PluginCallNode,
} from "./types";
import type { ColumnType, ComputeBlock, FuncBlock, PlotBlock, ResolvedPluginBlock, ResolvedSheetDocument, TableBlock, TableColumn, WindowBlock } from "../file-interface/types";

export class SheetSemanticAnalyzer {
  analyze(document: ResolvedSheetDocument): AnalyzedSheetDocument {
    const warnings = new WarningCollector();
    const context = this.buildContext(document, warnings);

    return {
      blocks: document.blocks.map((block) => {
        if (block.kind === "func") {
          return context.funcMap[block.name];
        }

        if (block.kind === "compute") {
          return this.analyzeComputeBlock(block, context, warnings);
        }

        if (block.kind === "window") {
          return this.analyzeWindowBlock(block, context, warnings);
        }

        if (block.kind === "plot") {
          return this.analyzePlotBlock(block, context);
        }

        return block;
      }),
      warnings: warnings.list(),
    };
  }

  private buildContext(document: ResolvedSheetDocument, warnings: WarningCollector): AnalysisContext {
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
        if (isKnownBuiltinFunction(block.name)) {
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

        const outputs = computeOutputMap[block.tableName] ?? {};
        for (const targetColumn of block.targets.columns) {
          outputs[targetColumn.name] = {
            ...targetColumn,
          };
        }
        computeOutputMap[block.tableName] = outputs;
      }

      if (block.kind === "window") {
        const table = tableMap[block.tableName];
        if (!table) {
          ThrowHelper.analysis("unknown_window_table", { table: block.tableName }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
        }

        const outputs = computeOutputMap[block.tableName] ?? {};
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

      const scopeBindings = new Map(funcBlock.params.map((param) => [param.name, { ...param }]));
      const localTypes: Record<string, ColumnType> = {};
      funcBlock.params.forEach((param) => {
        localTypes[param.name] = param.type;
      });
      const locals = new Map<string, typeof funcBlock.params[number]>();
      const statements: Array<AnalyzedFuncAssignmentStatement | AnalyzedFuncReturnStatement> = [];

      for (const statement of funcBlock.statements) {
        const parsedExpression = new ExpressionParser(statement.expression, {
          line: statement.expressionRange.startLine,
          column: statement.expressionRange.startColumn,
        }).parse();
        const boundExpression = this.bindFunctionExpression(
          parsedExpression,
          funcBlock,
          scopeBindings,
          analyzeFuncByName,
          [...stack, name],
        );

        if (statement.kind === "assign") {
          const inferredType = this.inferExpressionType(boundExpression, localTypes, warnings, "func", statement.source.startLine);
          const resolvedTarget = statement.target.type !== "dynamic"
            ? { ...statement.target }
            : { ...statement.target, type: inferredType };

          if (statement.target.type !== "dynamic") {
            this.assertTypeAssignable(
              statement.target.type,
              inferredType,
              `@func ${funcBlock.name} local ${statement.target.name}`,
              statement.expressionRange,
            );
          }

          localTypes[resolvedTarget.name] = resolvedTarget.type;
          scopeBindings.set(resolvedTarget.name, resolvedTarget);
          if (!funcBlock.params.some((param) => param.name === resolvedTarget.name)) {
            locals.set(resolvedTarget.name, resolvedTarget);
          }

          statements.push({
            ...statement,
            target: resolvedTarget,
            expression: boundExpression,
          });
          continue;
        }

          this.assertTypeAssignable(
            funcBlock.returnSpec.type,
            this.inferExpressionType(boundExpression, localTypes, warnings, "func", statement.source.startLine),
            `@func ${funcBlock.name} return value`,
            statement.expressionRange,
          );
        statements.push({
          kind: "return",
          expression: boundExpression,
          expressionRange: statement.expressionRange,
          source: statement.source,
        });
      }

      const analyzedFunc: AnalyzedFuncBlock = {
        kind: "func",
        name: funcBlock.name,
        nameRange: funcBlock.nameRange,
        params: funcBlock.params.map((param) => ({ ...param })),
        returnSpec: { ...funcBlock.returnSpec },
        locals: [...locals.values()],
        statements,
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
    const outputs = block.targets.columns.map((column) => ({ columnName: column.name, column, range: column.nameRange }));
    const outputSet = new Set(block.targets.columns.map((column) => column.name));

    for (const statement of block.statements) {
      if (!outputSet.has(statement.targetColumn.name)) {
        localNames.add(statement.targetColumn.name);
      }
    }

    const localTypes: Record<string, ColumnType> = {};
    const statements = block.statements.map((statement) => {
      const analyzedStatement = this.analyzeComputeStatement(statement, table, context, localNames);
      const expressionType = this.inferExpressionType(analyzedStatement.expression, localTypes, warnings, "compute", analyzedStatement.source.startLine);
      const outputColumn = block.targets.columns.find((column) => column.name === statement.targetColumn.name);
      let resolvedTargetColumn: TableColumn;

      if (outputColumn && statement.targetColumn.isTypeExplicit) {
        this.assertTypeAssignable(
          outputColumn.columnType,
          statement.targetColumn.columnType,
          `@compute ${table.name} target ${statement.targetColumn.name} declaration`,
          statement.targetRange,
        );
      }

      if (outputColumn) {
        this.assertTypeAssignable(
          outputColumn.columnType,
          expressionType,
          `@compute ${table.name} target ${statement.targetColumn.name}`,
          statement.expressionRange,
        );
        resolvedTargetColumn = outputColumn;
      } else {
        if (statement.targetColumn.isTypeExplicit) {
          this.assertTypeAssignable(
            statement.targetColumn.columnType,
            expressionType,
            `@compute ${table.name} local ${statement.targetColumn.name}`,
            statement.expressionRange,
          );
          localTypes[statement.targetColumn.name] = statement.targetColumn.columnType;
          resolvedTargetColumn = {
            ...statement.targetColumn,
            columnType: statement.targetColumn.columnType,
          };
        } else {
          localTypes[statement.targetColumn.name] = expressionType;
          resolvedTargetColumn = {
            ...statement.targetColumn,
            columnType: expressionType,
          };
        }
      }

      analyzedStatement.target = {
        columnName: statement.targetColumn.name,
        column: resolvedTargetColumn,
        range: statement.targetRange,
      };

      return analyzedStatement;
    });

    return {
      kind: "compute",
      tableName: block.tableName,
      tableNameRange: block.tableNameRange,
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
        columnName: statement.targetColumn.name,
        column: statement.targetColumn,
        range: statement.targetRange,
      },
      expression: this.bindExpression(parsedExpression, table, context, localNames),
      source: statement.source,
      isOutput: context.computeOutputMap[table.name][statement.targetColumn.name] !== undefined,
    };
  }

  private analyzeWindowBlock(
    block: WindowBlock,
    context: AnalysisContext,
    warnings: WarningCollector,
  ): AnalyzedWindowBlock {
    const table = context.tableMap[block.tableName];
    if (!table) {
      ThrowHelper.analysis("unknown_window_table", { table: block.tableName }, { range: ThrowHelper.pointRange(block.source.startLine, 1) });
    }

    const orderColumn = block.orderBy
      ? table.columns.find((column) => column.name === block.orderBy)
      : undefined;
    if (block.orderBy && !orderColumn) {
      ThrowHelper.analysis(
        "unknown_window_order",
        { column: block.orderBy, table: block.tableName },
        block.orderByRange ? { range: block.orderByRange } : { range: ThrowHelper.pointRange(block.source.startLine, 1) },
      );
    }

    const groupColumns = (block.groupBy ?? []).map((name) => {
      const column = table.columns.find((item) => item.name === name);
      if (!column) {
        ThrowHelper.analysis(
          "unknown_reference",
          { name, table: table.name },
          block.groupByRanges?.[name] ? { range: block.groupByRanges[name] } : { range: ThrowHelper.pointRange(block.source.startLine, 1) },
        );
      }
      return column;
    });

    const localNames = new Set<string>();
    const outputs = block.targets.columns.map((column) => ({ columnName: column.name, column, range: column.nameRange }));
    const outputSet = new Set(block.targets.columns.map((column) => column.name));

    for (const statement of block.statements) {
      if (!outputSet.has(statement.targetColumn.name)) {
        localNames.add(statement.targetColumn.name);
      }
    }

    const localTypes: Record<string, ColumnType> = {};
    const statements = block.statements.map((statement) => {
      const parsedExpression = new ExpressionParser(statement.expression, {
        line: statement.expressionRange.startLine,
        column: statement.expressionRange.startColumn,
      }).parse();
      const analyzedExpression = this.bindExpression(parsedExpression, table, context, localNames, "window");
      const expressionType = this.inferExpressionType(analyzedExpression, localTypes, warnings, "window", statement.source.startLine);
      const outputColumn = block.targets.columns.find((column) => column.name === statement.targetColumn.name);
      let resolvedTargetColumn: TableColumn;

      if (outputColumn) {
        this.assertTypeAssignable(
          outputColumn.columnType,
          expressionType,
          `@window ${table.name} target ${statement.targetColumn.name}`,
          statement.expressionRange,
        );
        resolvedTargetColumn = outputColumn;
      } else if (statement.targetColumn.isTypeExplicit) {
        this.assertTypeAssignable(
          statement.targetColumn.columnType,
          expressionType,
          `@window ${table.name} local ${statement.targetColumn.name}`,
          statement.expressionRange,
        );
        localTypes[statement.targetColumn.name] = statement.targetColumn.columnType;
        resolvedTargetColumn = {
          ...statement.targetColumn,
          columnType: statement.targetColumn.columnType,
        };
      } else {
        localTypes[statement.targetColumn.name] = expressionType;
        resolvedTargetColumn = {
          ...statement.targetColumn,
          columnType: expressionType,
        };
      }

      return {
        target: {
          columnName: statement.targetColumn.name,
          column: resolvedTargetColumn,
          range: statement.targetRange,
        },
        expression: analyzedExpression,
        source: statement.source,
        isOutput: outputSet.has(statement.targetColumn.name),
      };
    });

    return {
      ...block,
      outputs,
      outputColumns: block.targets.columns.map((column) => ({ ...column })),
      locals: [...localNames],
      statements,
      resolvedOrderColumn: orderColumn,
      resolvedGroupColumns: groupColumns,
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
    expressionContext: "compute" | "window" = "compute",
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
          operand: this.bindExpression(expression.operand, table, context, localNames, expressionContext),
          range: expression.range,
        };
      case "binary_expression":
        return {
          kind: "binary_expression",
          operator: expression.operator,
          left: this.bindExpression(expression.left, table, context, localNames, expressionContext),
          right: this.bindExpression(expression.right, table, context, localNames, expressionContext),
          range: expression.range,
        };
      case "call_expression":
        return this.resolveCallExpression(expression, table, context, localNames, expressionContext);
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
    expressionContext: "compute" | "window",
  ): BuiltinCallNode | FuncCallNode | PluginCallNode {
    const { callee, args, calleeRange } = expression;
    if (isBuiltinFunction(callee, expressionContext)) {
      return {
        kind: "builtin_call",
        name: callee,
        calleeRange,
        args: args.map((arg) => this.bindExpression(arg, table, context, localNames, expressionContext)),
        range: expression.range,
      };
    }
    if (isKnownBuiltinFunction(callee)) {
      ThrowHelper.analysis("builtin_context_not_allowed", { name: callee, context: expressionContext }, { range: calleeRange });
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
      if (localFunction.returnSpec.shape !== "scalar") {
        ThrowHelper.analysis(
          "non_scalar_function_call",
          { callee, shape: localFunction.returnSpec.shape },
          { range: calleeRange },
        );
      }

      return {
        kind: "func_call",
        functionName: callee,
        func: localFunction,
        calleeRange,
        args: args.map((arg) => this.bindExpression(arg, table, context, localNames, expressionContext)),
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
      calleeRange,
      args: args.map((arg) => this.bindExpression(arg, table, context, localNames, expressionContext)),
      range: expression.range,
    };
  }

  private bindFunctionExpression(
    expression: ParsedExpressionNode,
    funcBlock: FuncBlock,
    scopeBindings: Map<string, { name: string; type: ColumnType }>,
    analyzeFuncByName: (name: string, stack: string[], range?: DiagnosticRange) => AnalyzedFuncBlock,
    stack: string[],
  ): ExpressionNode {
    switch (expression.kind) {
      case "number_literal":
        return expression;
      case "identifier":
        if (!scopeBindings.has(expression.name)) {
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
          operand: this.bindFunctionExpression(expression.operand, funcBlock, scopeBindings, analyzeFuncByName, stack),
          range: expression.range,
        };
      case "binary_expression":
        return {
          kind: "binary_expression",
          operator: expression.operator,
          left: this.bindFunctionExpression(expression.left, funcBlock, scopeBindings, analyzeFuncByName, stack),
          right: this.bindFunctionExpression(expression.right, funcBlock, scopeBindings, analyzeFuncByName, stack),
          range: expression.range,
        };
      case "call_expression": {
        if (isBuiltinFunction(expression.callee, "func")) {
          return {
            kind: "builtin_call",
            name: expression.callee,
            calleeRange: expression.calleeRange,
            args: expression.args.map((arg) =>
              this.bindFunctionExpression(arg, funcBlock, scopeBindings, analyzeFuncByName, stack),
            ),
            range: expression.range,
          };
        }
        if (isKnownBuiltinFunction(expression.callee)) {
          ThrowHelper.analysis(
            "builtin_context_not_allowed",
            { name: expression.callee, context: "func" },
            { range: expression.calleeRange },
          );
        }

        if (expression.callee.includes(".")) {
          ThrowHelper.analysis("unsupported_function_call", { callee: expression.callee }, { range: expression.calleeRange });
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
        if (localFunction.returnSpec.shape !== "scalar") {
          ThrowHelper.analysis(
            "non_scalar_function_call",
            { callee: expression.callee, shape: localFunction.returnSpec.shape },
            { range: expression.calleeRange },
          );
        }
        return {
          kind: "func_call",
          functionName: expression.callee,
          func: localFunction,
          calleeRange: expression.calleeRange,
          args: expression.args.map((arg) =>
            this.bindFunctionExpression(arg, funcBlock, scopeBindings, analyzeFuncByName, stack),
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
    context: "compute" | "func" | "window",
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
        const operandType = this.inferExpressionType(expression.operand, localTypes, warnings, context, line);
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
        const leftType = this.inferExpressionType(expression.left, localTypes, warnings, context, line);
        const rightType = this.inferExpressionType(expression.right, localTypes, warnings, context, line);
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
        const argTypes = expression.args.map((arg) => this.inferExpressionType(arg, localTypes, warnings, context, line));
        if ((expression.name === "if" || expression.name === "and" || expression.name === "or") && argTypes.includes("dynamic")) {
          warnings.add(
            WarningHelper.analysis(
              "boolean_compatible_required",
              { context: `Arguments of ${expression.name}`, actual: "dynamic" },
              { range: expression.range, suggestion: "Use explicit boolean-typed inputs when calling boolean builtins." },
            ),
          );
        }
        if (context === "window") {
          const windowBuiltinType = this.inferWindowBuiltinType(expression, argTypes);
          if (windowBuiltinType) {
            return windowBuiltinType;
          }
        }
        return inferBuiltinFunctionTypeWithRanges(
          expression.name,
          expression.args.map((arg, index) => ({
            type: argTypes[index],
            range: arg.range,
          })),
          context,
          expression.range,
        );
      }
      case "func_call":
        return expression.func.returnSpec.type;
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

  private inferWindowBuiltinType(
    expression: BuiltinCallNode,
    argTypes: ColumnType[],
  ): ColumnType | null {
    switch (expression.name) {
      case "current":
      case "lag":
      case "lead":
      case "first":
      case "last": {
        const expectedArgs = expression.name === "lag" || expression.name === "lead" ? 2 : 1;
        if (argTypes.length !== expectedArgs) {
          ThrowHelper.analysis(
            "function_arity_mismatch",
            { name: expression.name, expected: expectedArgs, actual: argTypes.length },
            { range: expression.range },
          );
        }
        const firstArg = expression.args[0];
        if (firstArg?.kind !== "column_reference") {
          ThrowHelper.analysis("type_mismatch", {
            context: `Builtin ${expression.name} argument 1`,
            expected: "column reference",
            actual: firstArg ? firstArg.kind : "missing",
          }, { range: firstArg?.range ?? expression.range });
        }
        return firstArg.column.columnType;
      }
      case "cumsum": {
        if (argTypes.length !== 1) {
          ThrowHelper.analysis(
            "function_arity_mismatch",
            { name: expression.name, expected: 1, actual: argTypes.length },
            { range: expression.range },
          );
        }
        const firstArg = expression.args[0];
        if (firstArg?.kind !== "column_reference") {
          ThrowHelper.analysis("type_mismatch", {
            context: "Builtin cumsum argument 1",
            expected: "column reference",
            actual: firstArg ? firstArg.kind : "missing",
          }, { range: firstArg?.range ?? expression.range });
        }
        this.assertTypeAssignable("number", firstArg.column.columnType, "Builtin cumsum argument 1", firstArg.range);
        return "number";
      }
      case "row_number":
      case "rank":
        if (argTypes.length !== 0) {
          ThrowHelper.analysis(
            "function_arity_mismatch",
            { name: expression.name, expected: 0, actual: argTypes.length },
            { range: expression.range },
          );
        }
        return "number";
      default:
        return null;
    }
  }
}
