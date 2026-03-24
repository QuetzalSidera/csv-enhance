const path = require("path");
const { SheetCompiler, XlsxAdapter } = require("../dist/index.js");

// Compile the bundled retail.csvx file and export an .xlsx workbook beside it.
const projectRoot = path.resolve(__dirname, "..");
const inputPath = path.resolve(projectRoot, "examples/retail.csvx");
const outputPath = path.resolve(projectRoot, "examples/retail.xlsx");

const compiler = new SheetCompiler();
const xlsxAdapter = new XlsxAdapter();

const compiled = compiler.compilePath(inputPath);
xlsxAdapter.writeCompiledResult(compiled, outputPath);

console.log(`Compiled ${inputPath} -> ${outputPath}`);
