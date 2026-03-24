const {
  ANALYSIS_DIAGNOSTIC_SPECS,
  formatAnalysisErrorMessage,
  formatParserErrorMessage,
  formatRuntimeErrorMessage,
  formatWarningMessage,
  PARSER_DIAGNOSTIC_SPECS,
  RUNTIME_DIAGNOSTIC_SPECS,
  ThrowHelper,
  WARNING_DIAGNOSTIC_SPECS,
  WarningHelper,
} = require("../../dist/index.js");

describe("diagnostic catalogs", () => {
  test("parser diagnostic specs include bilingual docs and examples", () => {
    expect(PARSER_DIAGNOSTIC_SPECS).not.toHaveLength(0);

    for (const spec of PARSER_DIAGNOSTIC_SPECS) {
      expect(spec.key).toEqual(expect.any(String));
      expect(spec.zh).toEqual(expect.any(String));
      expect(spec.en).toEqual(expect.any(String));
      expect(spec.example).toEqual(expect.any(String));
      expect(spec.zh.length).toBeGreaterThan(0);
      expect(spec.en.length).toBeGreaterThan(0);
      expect(spec.example.length).toBeGreaterThan(0);
    }
  });

  test("analysis diagnostic specs include bilingual docs and examples", () => {
    expect(ANALYSIS_DIAGNOSTIC_SPECS).not.toHaveLength(0);

    for (const spec of ANALYSIS_DIAGNOSTIC_SPECS) {
      expect(spec.key).toEqual(expect.any(String));
      expect(spec.zh).toEqual(expect.any(String));
      expect(spec.en).toEqual(expect.any(String));
      expect(spec.example).toEqual(expect.any(String));
      expect(spec.zh.length).toBeGreaterThan(0);
      expect(spec.en.length).toBeGreaterThan(0);
      expect(spec.example.length).toBeGreaterThan(0);
    }
  });

  test("runtime and warning diagnostic specs include bilingual docs and examples", () => {
    expect(RUNTIME_DIAGNOSTIC_SPECS).not.toHaveLength(0);
    expect(WARNING_DIAGNOSTIC_SPECS).not.toHaveLength(0);

    for (const spec of [...RUNTIME_DIAGNOSTIC_SPECS, ...WARNING_DIAGNOSTIC_SPECS]) {
      expect(spec.key).toEqual(expect.any(String));
      expect(spec.zh).toEqual(expect.any(String));
      expect(spec.en).toEqual(expect.any(String));
      expect(spec.example).toEqual(expect.any(String));
      expect(spec.zh.length).toBeGreaterThan(0);
      expect(spec.en.length).toBeGreaterThan(0);
      expect(spec.example.length).toBeGreaterThan(0);
    }
  });

  test("diagnostic spec keys are unique within each phase", () => {
    const phases = [
      PARSER_DIAGNOSTIC_SPECS,
      ANALYSIS_DIAGNOSTIC_SPECS,
      RUNTIME_DIAGNOSTIC_SPECS,
      WARNING_DIAGNOSTIC_SPECS,
    ];

    for (const specs of phases) {
      const keys = specs.map((spec) => spec.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test("all parser diagnostic messages format successfully", () => {
    for (const spec of PARSER_DIAGNOSTIC_SPECS) {
      const message = formatParserErrorMessage(spec.key, spec.params);
      expect(message).toEqual(expect.any(String));
      expect(message.length).toBeGreaterThan(0);
    }
  });

  test("all analysis diagnostic messages format successfully", () => {
    for (const spec of ANALYSIS_DIAGNOSTIC_SPECS) {
      const message = formatAnalysisErrorMessage(spec.key, spec.params);
      expect(message).toEqual(expect.any(String));
      expect(message.length).toBeGreaterThan(0);
    }
  });

  test("all runtime diagnostic messages format successfully", () => {
    for (const spec of RUNTIME_DIAGNOSTIC_SPECS) {
      const message = formatRuntimeErrorMessage(spec.key, spec.params);
      expect(message).toEqual(expect.any(String));
      expect(message.length).toBeGreaterThan(0);
    }
  });

  test("all warning messages format successfully", () => {
    for (const spec of WARNING_DIAGNOSTIC_SPECS) {
      const message = formatWarningMessage(spec.key, spec.params);
      expect(message).toEqual(expect.any(String));
      expect(message.length).toBeGreaterThan(0);
    }
  });

  test("throw helper produces correctly phased parser errors for every parser key", () => {
    for (const spec of PARSER_DIAGNOSTIC_SPECS) {
      const error = ThrowHelper.createParser(spec.key, spec.params, {
        range: ThrowHelper.pointRange(1, 1),
      });

      expect(error.phase).toBe("parser");
      expect(error.code).toBe(`PARSER_${spec.key.toUpperCase()}`);
      expect(error.messageText).toBe(formatParserErrorMessage(spec.key, spec.params));
      expect(error.range).toEqual(ThrowHelper.pointRange(1, 1));
    }
  });

  test("throw helper produces correctly phased analysis errors for every analysis key", () => {
    for (const spec of ANALYSIS_DIAGNOSTIC_SPECS) {
      const error = ThrowHelper.createAnalysis(spec.key, spec.params, {
        range: ThrowHelper.pointRange(2, 3),
      });

      expect(error.phase).toBe("analysis");
      expect(error.code).toBe(`ANALYSIS_${spec.key.toUpperCase()}`);
      expect(error.messageText).toBe(formatAnalysisErrorMessage(spec.key, spec.params));
      expect(error.range).toEqual(ThrowHelper.pointRange(2, 3));
    }
  });

  test("throw helper produces correctly phased runtime errors for every runtime key", () => {
    for (const spec of RUNTIME_DIAGNOSTIC_SPECS) {
      const error = ThrowHelper.createRuntime(spec.key, spec.params, {
        range: ThrowHelper.pointRange(4, 5),
      });

      expect(error.phase).toBe("runtime");
      expect(error.code).toBe(`RUNTIME_${spec.key.toUpperCase()}`);
      expect(error.messageText).toBe(formatRuntimeErrorMessage(spec.key, spec.params));
      expect(error.range).toEqual(ThrowHelper.pointRange(4, 5));
    }
  });

  test("warning helper produces correctly phased warnings for every warning key", () => {
    for (const spec of WARNING_DIAGNOSTIC_SPECS) {
      const warning = WarningHelper.analysis(spec.key, spec.params, {
        range: ThrowHelper.pointRange(6, 7),
      });

      expect(warning.phase).toBe("analysis");
      expect(warning.severity).toBe("warning");
      expect(warning.code).toBe(`ANALYSIS_${spec.key.toUpperCase()}`);
      expect(warning.message).toBe(formatWarningMessage(spec.key, spec.params));
      expect(warning.range).toEqual(ThrowHelper.pointRange(6, 7));
    }
  });
});
