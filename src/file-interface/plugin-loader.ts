declare function require(name: string): any;

import { ThrowHelper } from "../diagnostics";
import type { PluginExport } from "./types";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

export class PluginModuleLoader {
  load(modulePath: string, exportNames: string[]): PluginExport[] {
    const resolvedModulePath = path.resolve(modulePath);
    const exportTypeMap = this.readPluginExportTypes(resolvedModulePath);
    const loadedModule = this.loadModuleExports(resolvedModulePath);
    const selectedExportNames = exportNames.length > 0 ? exportNames : Object.keys(loadedModule);

    return selectedExportNames.map((exportName) => {
      const exportedValue = loadedModule[exportName];
      if (typeof exportedValue !== "function") {
        ThrowHelper.runtime("plugin_export_not_function", { exportName, modulePath: resolvedModulePath });
      }

      const pluginExport = exportedValue as PluginExport;
      if (exportTypeMap[exportName]) {
        pluginExport.__sheetReturnType = exportTypeMap[exportName];
      }
      return pluginExport;
    });
  }

  private readPluginExportTypes(modulePath: string): Record<string, "dynamic" | "string" | "number" | "boolean" | "null"> {
    const extension = path.extname(modulePath).toLowerCase();
    if (extension !== ".ts") {
      return {};
    }

    const source = fs.readFileSync(modulePath, "utf8");
    return this.extractTypeScriptExportTypes(source);
  }

  private loadModuleExports(modulePath: string): Record<string, unknown> {
    const extension = path.extname(modulePath).toLowerCase();
    if (extension === ".js" || extension === ".cjs") {
      return require(modulePath);
    }

    if (extension !== ".ts") {
      ThrowHelper.runtime("plugin_module_extension_unsupported", { extension });
    }

    const source = fs.readFileSync(modulePath, "utf8");
    const transpiledSource = this.transpileTypeScriptPlugin(source);
    const module = { exports: {} as Record<string, unknown> };
    const moduleDirectory = path.dirname(modulePath);

    const localRequire = (request: string): unknown => {
      if (!request.startsWith(".") && !request.startsWith("/")) {
        ThrowHelper.runtime("plugin_import_path_must_be_local", { request });
      }

      const childModulePath = path.resolve(moduleDirectory, request);
      return this.loadModuleExports(childModulePath);
    };

    const script = new vm.Script(transpiledSource, { filename: modulePath });
    script.runInNewContext({
      module,
      exports: module.exports,
      require: localRequire,
      __filename: modulePath,
      __dirname: moduleDirectory,
    });

    return module.exports;
  }

  private transpileTypeScriptPlugin(source: string): string {
    let code = source;

    code = code.replace(
      /export\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*([A-Za-z_][A-Za-z0-9_<>\[\]\s|]*))?\s*\{/g,
      (_match: string, name: string, params: string) => {
        return `exports.${name} = function ${name}(${this.stripTypeAnnotations(params)}) {`;
      },
    );

    code = code.replace(
      /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(([\s\S]*?)\)\s*(?::\s*([A-Za-z_][A-Za-z0-9_<>\[\]\s|]*))?\s*=>/g,
      (_match: string, name: string, params: string) => {
        return `exports.${name} = (${this.stripTypeAnnotations(params)}) =>`;
      },
    );

    if (/\bexport\s+default\b/.test(code)) {
      ThrowHelper.runtime("plugin_default_export_unsupported");
    }

    return code;
  }

  private extractTypeScriptExportTypes(
    source: string,
  ): Record<string, "dynamic" | "string" | "number" | "boolean" | "null"> {
    const exportTypes: Record<string, "dynamic" | "string" | "number" | "boolean" | "null"> = {};
    let match: RegExpExecArray | null;

    const functionPattern =
      /export\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\)\s*(?::\s*([A-Za-z_][A-Za-z0-9_<>\[\]\s|]*))?\s*\{/g;
    while ((match = functionPattern.exec(source)) !== null) {
      exportTypes[match[1]] = this.mapTypeScriptTypeToColumnType(match[3]);
    }

    const constPattern =
      /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(([\s\S]*?)\)\s*(?::\s*([A-Za-z_][A-Za-z0-9_<>\[\]\s|]*))?\s*=>/g;
    while ((match = constPattern.exec(source)) !== null) {
      exportTypes[match[1]] = this.mapTypeScriptTypeToColumnType(match[3]);
    }

    return exportTypes;
  }

  private mapTypeScriptTypeToColumnType(typeAnnotation?: string): "dynamic" | "string" | "number" | "boolean" | "null" {
    const normalizedType = (typeAnnotation ?? "").replace(/\s+/g, "").toLowerCase();
    switch (normalizedType) {
      case "number":
        return "number";
      case "string":
        return "string";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      default:
        return "dynamic";
    }
  }

  private stripTypeAnnotations(params: string): string {
    return params.replace(/([A-Za-z_][A-Za-z0-9_]*)\s*\??\s*:\s*([A-Za-z_][A-Za-z0-9_<>\[\]\s|]*)/g, "$1");
  }
}
