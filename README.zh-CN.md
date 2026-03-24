<p align="center">
  <img src="./asset/Logo.webp" alt="CSVX logo" width="160" />
</p>

<h1 align="center">CSVX</h1>

<p align="center">
  轻量、AI 友好、纯文本优先的电子表格格式。
</p>

<p align="center">
  <a href="https://github.com/QuetzalSidera/csv-enhance"><img alt="repo" src="https://img.shields.io/badge/GitHub-csv--enhance-111827?logo=github"></a>
  <img alt="npm" src="https://img.shields.io/badge/npm-csvx--lang-cb3837?logo=npm">
  <img alt="version" src="https://img.shields.io/badge/version-0.1.0-111827">
  <img alt="status" src="https://img.shields.io/badge/status-demo-f59e0b">
  <img alt="language" src="https://img.shields.io/badge/language-TypeScript-3178c6">
  <img alt="export" src="https://img.shields.io/badge/export-.xlsx-16a34a">
  <img alt="editor" src="https://img.shields.io/badge/editor-VS%20Code-007acc">
  <img alt="tests" src="https://img.shields.io/badge/tests-68%20passing-22c55e">
</p>

CSVX 是一种轻量、AI 友好、纯文本优先的电子表格格式。

它站在这些东西的中间：

- CSV
- 电子表格
- 结构化数据 DSL

CSVX 的目标是：

- 纯文本就能读懂
- 适合版本管理
- 足够表达计算列和窗口列
- 可以编译成 `.xlsx`
- 在编辑器和自动化场景里也顺手

npm 包名是 `csvx-lang`。
安装后的命令行入口仍然是 `csvx`。

---

## 一眼看懂

- 兼容 CSV 风格的表格输入
- 支持强类型列
- `@compute` 用来生成按行计算的新列
- `@func` 用来复用内联逻辑
- `@plugin` 用来引入可信的本地 TypeScript 帮手
- `@window` 用来生成跨行窗口列
- `@plot` 用来声明图表规格
- CLI 可直接 lint、compile、导出 `.xlsx`
- VS Code 扩展已支持高亮、诊断、hover、definition、references 和 completion

---

## 文档入口

现在所有项目文档都集中放在 [docs](/Users/qianshuang/Project/WebProject/csv-enhance/docs) 目录下。

### 新手友好文档

- [WIKI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.en.md)
- [WIKI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.zh-CN.md)
- [AGENT.md](/Users/qianshuang/Project/WebProject/csv-enhance/AGENT.md)

### 语法参考

- [REFERENCE.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.en.md)
- [REFERENCE.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.zh-CN.md)

### 内置函数

- [BUILTINS.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.en.md)
- [BUILTINS.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.zh-CN.md)

### 命令行

- [CLI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CLI.en.md)
- [CLI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CLI.zh-CN.md)

### 参与贡献

- [CONTRIBUTING.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CONTRIBUTING.en.md)
- [CONTRIBUTING.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CONTRIBUTING.zh-CN.md)

### 项目说明

- [ROADMAP.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.en.md)
- [ROADMAP.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.zh-CN.md)
- [TYPE_SYSTEM.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/TYPE_SYSTEM.md)
- [CHANGELOG.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CHANGELOG.md)
- [RELEASING.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/RELEASING.en.md)

---

## 快速开始

构建项目：

```bash
npm run build
```

运行测试：

```bash
npm test
```

体验命令行：

```bash
node dist/cli/csvx.js lint ./examples/retail.csvx
node dist/cli/csvx.js compile ./examples/retail.csvx
node dist/cli/csvx.js xlsx ./examples/retail.csvx
```

---

## 当前状态

CSVX 目前已经支持：

- 强类型表格
- `@compute`
- `@func`
- `@plugin`
- `@window`
- `@plot`
- `.xlsx` 导出
- CLI 工作流
- 第一版编辑器能力

目前最完整的编辑器支持是 VS Code。
