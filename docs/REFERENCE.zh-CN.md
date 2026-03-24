# CSVX 语法 Reference

这份文档面向更熟悉 CSVX 的读者。

如果你是第一次接触，请先看：

- [WIKI.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/WIKI.zh-CN.md)

---

## 支持的指令

### `@meta`

用于存储简单元数据。

```csvx
@meta
title: 周报
owner: finance
```

规则：

- 不带块名
- 只能写 `key: value`
- key 必须是合法标识符

### `@plugin <alias>`

用于声明受信的外部插件别名。

```csvx
@plugin finance
path: ./plugins/finance.ts
exports: tax, bucket
```

规则：

- `path:` 必填
- `exports:` 可选
- 相对路径相对于当前 `.csvx` 文件解析

### `@table <name>`

用于声明表格数据。

```csvx
@table sales
region[string],price[number],qty[number]
North,3,5
```

规则：

- 第一行是表头
- 表头必须唯一
- 每行列数必须与表头一致

### `@func <signature>`

用于声明可复用纯函数。

```csvx
@func tax(price[number], qty[number]) => number
subtotal[number] = price * qty;
return subtotal * 1.08;
```

规则：

- 函数体支持多语句
- 语句用 `;` 分隔
- 必须有 `return`
- 参数与局部变量可写成 `name[type]`、`name[row:type]`、`name[col:type]`

### `@compute <table-name>`

用于声明逐行计算列。

```csvx
@compute sales
target: revenue[number]
revenue = price * qty
```

规则：

- `target:` 必填
- 不在 `target:` 中的赋值视为局部变量
- 输出会物化成表列

### `@window <table-name>`

用于声明跨行窗口列。

```csvx
@window sales
group: region
order: qty
target: running_revenue[number]
running_revenue = cumsum(revenue)
```

规则：

- `target:` 必填
- `group:` 可选
- `order:` 可选
- 不写 `group:` 时整表视为一个组
- 不写 `order:` 时默认使用文件顺序

### `@plot <table-name>`

用于声明图表。

```csvx
@plot sales
deps: revenue,running_revenue
x: revenue
y: running_revenue
title: Revenue vs running revenue
```

规则：

- `deps:` 必填
- `x:` 必填
- `y:` 必填

---

## 注释

CSVX 使用 `#` 作为单行注释。

```csvx
# 注释
```

任何 `trim` 后以 `#` 开头的整行都会被忽略。

---

## 标识符

标识符支持 Unicode。

例如：

- `sales`
- `销售表`
- `含税销售额`

适用位置：

- 表名
- 列名
- 函数名
- 插件别名
- target

---

## 类型

### 元素类型

- `number`
- `string`
- `boolean`
- `null`
- `dynamic`

### 形状写法

```csvx
name[number]
name[row:number]
name[col:number]
```

当前实际规则：

- 表和输出上下文更偏列语义
- 函数与局部上下文更偏标量语义

### `dynamic`

`dynamic` 的解析顺序：

1. `null`
2. `number`
3. `boolean`
4. `string`

隐式 `dynamic` 列可能在整列解析后被推断。

显式声明的列不会被自动改写类型。

---

## 表达式

### 运算符

- `+`
- `-`
- `*`
- `/`
- 括号 `()`

### 内置函数

通用内置函数：

- `if`
- `coalesce`
- `and`
- `or`

窗口专用内置函数：

- `current`
- `lag`
- `lead`
- `first`
- `last`
- `row_number`
- `rank`
- `cumsum`

详见：

- [BUILTINS.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.zh-CN.md)

---

## 默认行为

- 第一个 block 不以 `@` 开头 -> 隐式 `@table sheet`
- 不写类型 -> `dynamic`
- 不写 `@window order:` -> 默认文件顺序
- 不写 `@window group:` -> 整表视为一个组
- 不在 `target:` 中的赋值 -> 局部变量

---

## 可见性规则

后续 block 可以继续引用：

- 表列
- `@compute` 输出列
- `@window` 输出列

后续 block 不能直接引用：

- `@compute` 局部变量
- `@window` 局部变量
- `@func` 局部变量
