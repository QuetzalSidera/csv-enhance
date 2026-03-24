const { childProcess, fs, projectPath, XLSX } = require("./helpers/csvx-test-kit.js");

describe("Bundled examples", () => {
  test("retail example script compiles to xlsx", () => {
    const scriptPath = projectPath("examples/compile-retail.js");
    const outputPath = projectPath("examples/retail.xlsx");

    const output = childProcess.execFileSync("node", [scriptPath], {
      cwd: projectPath(),
      encoding: "utf8",
    });

    expect(output).toContain("Compiled");
    expect(fs.existsSync(outputPath)).toBe(true);

    const workbook = XLSX.readFile(outputPath);
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["sales", "_plots"]));
  });

  test("chinese-sales example script compiles to xlsx", () => {
    const scriptPath = projectPath("examples/compile-chinese-sales.js");
    const outputPath = projectPath("examples/chinese-sales.xlsx");

    const output = childProcess.execFileSync("node", [scriptPath], {
      cwd: projectPath(),
      encoding: "utf8",
    });

    expect(output).toContain("Compiled");
    expect(fs.existsSync(outputPath)).toBe(true);

    const workbook = XLSX.readFile(outputPath);
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["销售表", "_plots"]));
  });

  test("bundled examples compile through the csvx CLI", () => {
    const cliPath = projectPath("dist/cli/csvx.js");
    const retailPath = projectPath("examples/retail.csvx");
    const chinesePath = projectPath("examples/chinese-sales.csvx");

    const retailOutput = childProcess.execFileSync("node", [cliPath, "compile", retailPath], {
      cwd: projectPath(),
      encoding: "utf8",
    });
    const chineseOutput = childProcess.execFileSync("node", [cliPath, "compile", chinesePath], {
      cwd: projectPath(),
      encoding: "utf8",
    });

    expect(retailOutput).toContain("table sales rows=6");
    expect(chineseOutput).toContain("table 销售表 rows=3");
  });
});
