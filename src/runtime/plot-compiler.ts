import type { EvaluatedPlot } from "./types";
import { ThrowHelper } from "../diagnostics";

export type VegaLiteFieldType = "quantitative" | "nominal";

export interface VegaLiteEncodingField {
  field: string;
  type: VegaLiteFieldType;
}

export interface VegaLiteBarSpec {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json";
  mark: "bar";
  title?: string;
  data: {
    values: Array<Record<string, unknown>>;
  };
  encoding: {
    x: VegaLiteEncodingField;
    y: VegaLiteEncodingField;
    color?: VegaLiteEncodingField;
  };
}

export class PlotCompiler {
  compileBarPlot(plot: EvaluatedPlot): VegaLiteBarSpec {
    const xField = plot.fields.x;
    const yField = plot.fields.y;

    if (!xField || !yField) {
      ThrowHelper.runtime("plot_axes_required", { table: plot.tableName });
    }

    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "bar",
      title: plot.fields.title,
      data: {
        values: plot.rows.map((row) => this.serializeRow(row)),
      },
      encoding: {
        x: this.buildEncodingField(plot, xField),
        y: this.buildEncodingField(plot, yField),
        ...(plot.fields.color ? { color: this.buildEncodingField(plot, plot.fields.color) } : {}),
      },
    };
  }

  private buildEncodingField(plot: EvaluatedPlot, fieldName: string): VegaLiteEncodingField {
    const dependency = plot.resolvedDependencies.find((candidate) => candidate.name === fieldName);
    if (!dependency) {
      ThrowHelper.runtime("plot_field_unknown", { field: fieldName, table: plot.tableName });
    }

    return {
      field: fieldName,
      type: dependency.columnType === "number" ? "quantitative" : "nominal",
    };
  }

  private serializeRow(row: EvaluatedPlot["rows"][number]): Record<string, unknown> {
    const serializedRow: Record<string, unknown> = {};

    for (const fieldName of Object.keys(row)) {
      serializedRow[fieldName] = row[fieldName].value;
    }

    return serializedRow;
  }
}
