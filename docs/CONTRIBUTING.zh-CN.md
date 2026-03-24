# 参与贡献

感谢愿意为 CSVX 做贡献。

这个项目还很年轻，这反而是件好事：  
很多看起来“不大”的改动，其实都能明显提升格式本身、工具体验和新手上手感受。

在 CSVX 里，好的贡献不一定是“特别大的一坨功能”。  
很多时候，下面这些同样非常有价值：

- 更清楚的示例
- 更准确的报错
- 更顺手的语法细节
- 更扎实的测试

---

## 哪些贡献最有价值

尤其欢迎下面这些方向：

- 让 CSVX 保持轻量和可读的语言设计改进
- runtime 正确性修复
- 编辑器支持
- CLI 体验打磨
- plot / 渲染能力增强
- 文档和新手体验优化
- 示例与测试补充

如果拿不准方向，优先考虑这些原则：

- 清晰
- 一致
- 对新手友好
- 行为可预测

---

## 开始前建议先看什么

先快速扫一遍这些文档，会很有帮助：

- [README.md](/Users/qianshuang/Project/WebProject/csv-enhance/README.md)
- [README.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/README.zh-CN.md)
- [WIKI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.zh-CN.md)
- [REFERENCE.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.zh-CN.md)
- [TYPE_SYSTEM.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/TYPE_SYSTEM.md)
- [ROADMAP.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.zh-CN.md)

它们能帮助理解：

- CSVX 想成为什么
- 现在已经做到什么
- 哪些行为是有意为之的

---

## 开发环境

安装依赖：

```bash
npm install
```

构建项目：

```bash
npm run build
```

运行测试：

```bash
npm test
```

打包 VS Code 扩展：

```bash
npm run package:vscode-extension
```

---

## 项目原则

提交改动时，尽量和下面这些原则保持一致。

### 1. CSVX 应该保持可读

如果一个新特性让 `.csvx` 文件明显更难读，那它大概率值得再推敲一下。

### 2. CSVX 应该保持轻量

它不应该慢慢漂移成一门又重又难解释的小语言。

### 3. AI 友好性是真目标

低歧义、稳定、容易生成和修改的语法，是 CSVX 的核心设计目标之一。

### 4. 强类型应该帮忙，而不是吓人

类型系统应该可靠、可预测、在关键处足够明确，但不应该让小文件也显得负担很重。

### 5. 新手体验很重要

一个特性可以在技术上完全正确，但对第一次接触的人来说仍然太难。  
请同时考虑初学者和高级用户。

---

## 代码风格

尽量让改动保持：

- 清楚胜过炫技
- 小步胜过铺很大
- 显式胜过魔法

额外建议：

- 除非文件本身已经明确使用 Unicode，否则优先使用 ASCII
- 注释尽量短而有用
- 避免不必要的抽象
- 尽量保持现有分层结构

如果你碰 parser、analyzer、runtime 或 editor 代码，尽量守住这些边界：

- file interface 负责解析源文件
- analysis 负责理解语义
- runtime 负责执行
- editor 负责消费结构化语言信息

---

## 测试

行为变化通常都应该带测试。

尤其是当你修改这些部分时：

- 解析规则
- 类型行为
- diagnostics
- runtime 执行
- CLI 输出
- editor 能力

项目里已经有不少 fixture-based 测试。  
如果合适，优先补一个小而准的 fixture，而不是在测试里塞一大段硬编码字符串。

---

## 文档更新预期

如果改动影响了语言或用户工作流，也请一起更新相关文档。

常见会涉及这些：

- [WIKI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.en.md)
- [WIKI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.zh-CN.md)
- [REFERENCE.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.en.md)
- [REFERENCE.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.zh-CN.md)
- [BUILTINS.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.en.md)
- [BUILTINS.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.zh-CN.md)
- [CLI.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CLI.en.md)
- [CLI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/CLI.zh-CN.md)
- [ROADMAP.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.en.md)
- [ROADMAP.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/ROADMAP.zh-CN.md)

如果改动影响新手的理解路径，就更新 Wiki。  
如果改动影响精确语法，就更新 Reference。

---

## Commit Message 格式

请使用：

```text
<type>(<scope>): <subject>
```

允许的 `type`：

- `feat`
- `fix`
- `to`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `chore`
- `revert`
- `merge`
- `sync`

例子：

```text
feat(editor): add builtin completion
fix(parser): preserve implicit table name
docs(wiki): simplify dynamic type explanation
test(runtime): cover grouped window output
```

建议：

- `subject` 尽量短
- `scope` 尽量具体
- 尽量描述真实的用户可见变化

---

## 很适合作为第一次贡献的事情

如果你想找一个不容易踩坑的切入点，通常这些都很合适：

- 改进一条错误提示
- 补一个小而准的测试
- 优化一个文档示例
- 给 editor 增加一个小能力
- 改善一段新手向解释
- 补一个更贴近真实业务的 `.csvx` 示例

这些贡献往往比想象中更有价值。

---

## 如果要提比较大的语言改动

对于语法和语义上的改动，请尤其多看这几件事：

- 可读性
- 向后兼容
- 歧义
- 对编辑器能力的影响
- 对 AI 生成稳定性的影响

一个特性如果只是少打几个字，但明显让文件更难读，通常不是好交易。

---

## 提交前的小检查清单

在开 PR 或提交补丁前，最好先看一眼：

- 项目还能不能 build
- 测试是否通过
- 文档是否和行为一致
- 示例是否仍然合理
- 改动是否还贴合现有架构

通常把这几件事看一遍，review 就会顺很多。

