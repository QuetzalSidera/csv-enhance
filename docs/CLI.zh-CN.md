# CSVX 命令行指南

这份文档专门介绍 CSVX 当前的命令行工具。

如果把 CSVX 想成一个会处理表格的小工厂，那么 CLI 就是工厂门口的操作面板。

现在最常用的三个命令是：

- `csvx lint`
- `csvx compile`
- `csvx xlsx`

---

## 当前支持的命令

目前已经实现：

- `csvx lint <file.csvx>`
- `csvx compile <file.csvx>`
- `csvx xlsx <file.csvx> [-o <output.xlsx>]`

也就是说，现在命令行已经不只是“查错”，还可以真正完成编译和导出。

---

## 使用前先 build

如果是在本地仓库里直接运行，先构建一次：

```bash
npm run build
```

---

## 本地直接运行

可以直接运行编译后的 CLI：

```bash
node dist/cli/csvx.js lint ./examples/retail.csvx
node dist/cli/csvx.js compile ./examples/retail.csvx
node dist/cli/csvx.js xlsx ./examples/retail.csvx
```

---

## 安装后的二进制命令

如果通过 npm 安装命令行工具，先安装：

```bash
npm install -g csvx-lang
```

安装后就可以直接这样用：

```bash
csvx lint ./examples/retail.csvx
csvx compile ./examples/retail.csvx
csvx xlsx ./examples/retail.csvx
```

兼容别名仍然保留：

```bash
sheet lint ./examples/retail.csvx
```

---

## `csvx lint`

### 它做什么

会依次执行：

- parser 校验
- 语义分析
- 内置 warning
- 自定义 lint 规则

### 什么时候用

适合在：

- 改完 `.csvx` 之后先自查
- 提交前检查
- CI 里做基础校验

### 输出特点

- 有错误会报错
- 有 warning 会提示
- 只有 warning 时，不会让命令失败

---

## `csvx compile`

### 它做什么

会跑完整个编译链路，并打印摘要信息，比如：

- 一共有几张表
- 每张表有多少行、多少列
- 生成了几个 plot

### 什么时候用

适合在你想确认：

- `.csvx` 能不能完整跑通
- 数据和图表有没有正常进入编译链路

时使用。

---

## `csvx xlsx`

### 它做什么

会执行同样的完整编译流程，并最终写出一个 `.xlsx` 文件。

### 默认输出规则

如果不写 `-o`：

```bash
csvx xlsx sales.csvx
```

默认会生成：

```text
sales.xlsx
```

### 指定输出路径

```bash
csvx xlsx sales.csvx -o output/report.xlsx
```

这在自动化脚本和批处理里会更方便。

---

## 退出码

命令行退出码目前很简单：

- `0`
  - 没有错误
- `1`
  - 至少有一个错误

warning 仍然会显示，但不会单独让命令失败。

---

## 当前限制

CLI 目前还没有完整覆盖这些方向：

- 批量处理多个 `.csvx` 文件
- 机器可读的 JSON 输出
- 更丰富的导出目标

不过主干流程已经可用：

- lint
- compile
- xlsx

---

## 相关文件

- [src/cli/app.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/app.ts)
- [src/cli/csvx.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/csvx.ts)
- [src/cli/sheet.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/sheet.ts)
- [src/cli/format.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/cli/format.ts)
- [src/runtime/sheet-compiler.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/sheet-compiler.ts)
- [src/runtime/xlsx-adapter.ts](/Users/qianshuang/Project/WebProject/csv-enhance/src/runtime/xlsx-adapter.ts)

---

## 下一步适合补什么

CLI 后续很值得继续加强：

1. `--json` 输出
2. 批量处理多个文件
3. 更多导出目标
4. 更适合 CI 的命令行模式
