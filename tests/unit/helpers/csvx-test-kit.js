const path = require("path");
const fs = require("fs");
const os = require("os");
const childProcess = require("child_process");
const XLSX = require("xlsx");
const {
  ComputeExecutor,
  DefaultSheetFileReader,
  DocumentExecutor,
  ExpressionEvaluator,
  PlotCompiler,
  SheetDiagnosticError,
  SheetCompiler,
  isBuiltinFunction,
  isKnownBuiltinFunction,
  SheetLinter,
  SheetSemanticAnalyzer,
  XlsxAdapter,
} = require("../../../dist/index.js");

function createServices() {
  const reader = new DefaultSheetFileReader();
  const analyzer = new SheetSemanticAnalyzer();
  const evaluator = new ExpressionEvaluator();
  const computeExecutor = new ComputeExecutor(evaluator);
  const documentExecutor = new DocumentExecutor(computeExecutor);
  const plotCompiler = new PlotCompiler();
  const sheetCompiler = new SheetCompiler(reader, analyzer, documentExecutor, plotCompiler);
  const linter = new SheetLinter(reader, analyzer);
  const xlsxAdapter = new XlsxAdapter();

  return {
    reader,
    analyzer,
    evaluator,
    computeExecutor,
    documentExecutor,
    plotCompiler,
    sheetCompiler,
    linter,
    xlsxAdapter,
  };
}

function fixturePath(group, name) {
  return path.resolve(__dirname, `../../fixtures/${group}/${name}`);
}

function projectPath(...segments) {
  return path.resolve(__dirname, "../../..", ...segments);
}

function writeTempCsvx(prefix, fileName, source) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const filePath = path.join(directory, fileName);
  fs.writeFileSync(filePath, source, "utf8");
  return { directory, filePath };
}

module.exports = {
  XLSX,
  childProcess,
  createServices,
  fixturePath,
  fs,
  isBuiltinFunction,
  isKnownBuiltinFunction,
  path,
  projectPath,
  SheetDiagnosticError,
  writeTempCsvx,
};
