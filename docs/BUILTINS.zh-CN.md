# CSVX 内置函数

这份文档专门介绍 CSVX 当前内置的表达式函数。

内置函数的意思很简单：

- 不需要写 `@plugin`
- 不需要额外文件
- 直接就能在表达式里使用

不过要注意：

- 有些函数可以在 `@compute`、`@func`、`@window` 里都用
- 有些函数只能在 `@window` 里用

所以最重要的问题通常不是“这个函数存不存在”，而是：

**它能不能在这个 block 里用。**

---

## 一眼看懂：函数能在哪用

### 通用内置函数

这些函数可以在下面这些地方使用：

- `@compute`
- `@func`
- `@window`

包括：

- `if`
- `coalesce`
- `and`
- `or`

### 窗口专用内置函数

这些函数只能在 `@window` 中使用：

- `current`
- `lag`
- `lead`
- `first`
- `last`
- `row_number`
- `rank`
- `cumsum`

如果把这些函数写进 `@compute` 或 `@func`，CSVX 编译器会直接报错。

---

## `if`

### 作用

按条件在两个结果之间二选一。

### 写法

```csvx
if(condition, thenValue, elseValue)
```

### 例子

```csvx
level = if(price > 10, "high", "low")
```

### 怎么理解

它像一个很快的分岔路口：

- 条件成立，走左边
- 条件不成立，走右边

### 使用上下文

- `@compute`
- `@func`
- `@window`

---

## `coalesce`

### 作用

返回第一个不是 `null` 的值。

### 写法

```csvx
coalesce(value, fallback, ...)
```

### 例子

```csvx
final_price = coalesce(discount_price, original_price, 0)
```

### 怎么理解

像依次问几个人：

- 你有答案吗？
- 没有？那下一个
- 谁先有，就用谁

### 使用上下文

- `@compute`
- `@func`
- `@window`

---

## `and`

### 作用

只有所有条件都为真时，结果才是 `true`。

### 写法

```csvx
and(a, b, ...)
```

### 例子

```csvx
valid = and(enabled, reviewed)
```

### 怎么理解

像门口有两个保安：

- 一个点头不够
- 全都点头才放行

### 使用上下文

- `@compute`
- `@func`
- `@window`

---

## `or`

### 作用

只要有一个条件为真，结果就是 `true`。

### 写法

```csvx
or(a, b, ...)
```

### 例子

```csvx
available = or(in_stock, pre_order)
```

### 怎么理解

像多个入口，只要有一个能进，就算能进。

### 使用上下文

- `@compute`
- `@func`
- `@window`

---

## `current`

### 作用

在窗口计算里，取当前行对应的列值。

### 写法

```csvx
current(column)
```

### 例子

```csvx
current_amount = current(amount)
```

### 怎么理解

站在队伍里看“现在轮到的这个人”的值。

### 使用上下文

- 仅 `@window`

---

## `lag`

### 作用

取同一窗口组里“前面第 N 个”的值。

### 写法

```csvx
lag(column, offset?)
```

### 例子

```csvx
previous_amount = lag(amount, 1)
```

### 怎么理解

像回头看队伍里的前一个人。

### 使用上下文

- 仅 `@window`

---

## `lead`

### 作用

取同一窗口组里“后面第 N 个”的值。

### 写法

```csvx
lead(column, offset?)
```

### 例子

```csvx
next_amount = lead(amount, 1)
```

### 怎么理解

像往前看队伍里的下一个人。

### 使用上下文

- 仅 `@window`

---

## `first`

### 作用

取当前窗口组里的第一个值。

### 写法

```csvx
first(column)
```

### 例子

```csvx
first_amount = first(amount)
```

### 怎么理解

像问：“这一组里第一个人是谁？”

### 使用上下文

- 仅 `@window`

---

## `last`

### 作用

取当前窗口组里的最后一个值。

### 写法

```csvx
last(column)
```

### 例子

```csvx
last_amount = last(amount)
```

### 怎么理解

像问：“这一组里最后一个人是谁？”

### 使用上下文

- 仅 `@window`

---

## `row_number`

### 作用

返回当前行在窗口组中的位置，从 `1` 开始。

### 写法

```csvx
row_number()
```

### 例子

```csvx
row_id = row_number()
```

### 怎么理解

像给排队的人发号码牌：

- 第一个是 1
- 第二个是 2
- 第三个是 3

### 使用上下文

- 仅 `@window`

---

## `rank`

### 作用

返回当前行在窗口顺序中的排名，从 `1` 开始。

### 写法

```csvx
rank()
```

### 例子

```csvx
rank_value = rank()
```

### 怎么理解

像成绩单里的名次。

### 使用上下文

- 仅 `@window`

---

## `cumsum`

### 作用

对数值列做累计和。

### 写法

```csvx
cumsum(column)
```

### 例子

```csvx
running_amount = cumsum(amount)
```

### 怎么理解

像记流水账：

- 第一个人花了 10
- 第二个人花了 20
- 那到第二个人为止就是 30

### 使用上下文

- 仅 `@window`

---

## 一个很重要的提醒

虽然编辑器会把这些内置函数都高亮出来，但：

- 高亮不等于任何地方都能用

真正决定“这里能不能写这个函数”的，是编译器的语义检查。

所以如果在 `@compute` 里写：

```csvx
running_total = cumsum(total)
```

编辑器可能先把 `cumsum` 高亮成内置函数，  
但编译器随后会告诉你：

“这个函数只能在 `@window` 里用。”

