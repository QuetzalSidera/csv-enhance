# CSVX 新手 Wiki

欢迎来到 CSVX 的世界。

别紧张，这不是什么“先背三页术语表才能继续”的项目。  
你可以先把它理解成：

**一个比 CSV 更聪明、比 Excel 更轻、对人和 AI 都更友好的表格格式。**

如果要用一句特别接地气的话来形容它：

**CSVX 就像给朴素的 CSV 请来了一队小助手。**

它们会帮你：

- 认列名
- 看类型
- 算新列
- 做跨行计算
- 描述图表
- 最后再变成 `.xlsx`

如果你想查完整语法，请去看：

- [REFERENCE.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.zh-CN.md)

这份文档不走“查字典”路线。  
它走的是“第一次接触也能看懂”的路线。

---

## 🌱 这个项目是干嘛的

我们先说人话。

CSVX 想解决一个很常见的问题：

- CSV 很轻，很好写，但太“裸”
- Excel 很强，但文件太重、太黑盒
- `.xlsx` 对 AI 和 Git 来说也不算特别友好

于是 CSVX 站出来说：

“要不我来当个中间人吧。”

于是它变成了这样一种东西：

- 像 CSV 一样轻
- 像电子表格一样会算
- 像代码一样能读
- 像文档一样适合版本管理

你可以把它理解成：

**轻量、可扩展、纯文本的电子表格。**

---

## 🎬 先从 CSV 开始，不要一上来就学全套

理解 CSVX，最好的入口其实不是 `@compute`、`@window` 这些看起来很厉害的词。

最好的入口，是你已经认识的老朋友：CSV。

比如一个普通 CSV：

```text
item,price,count
apple,3,5
banana,2,10
```

这玩意儿大家都认识。

像一张简简单单的购物小票：

- 商品
- 单价
- 数量

CSVX 对它说：

“你先别动，你已经很好了。我只是在你身上加一点点超能力。”

所以，这样的内容直接保存成 `.csvx`，依然合法。

没错，CSVX 兼容 CSV。  
这点非常重要，因为它意味着：

- 你可以从最简单的表开始
- 不需要第一天就学整套 DSL

---

## 🧩 第一个最小示例：就从一个小表开始

先看这个：

```csvx
item,price,count
apple,3,5
banana,2,10
```

这已经是合法的 CSVX。

为什么？

因为 CSVX 有个很贴心的默认行为：

如果文件开头不是 `@table` 这种指令，它会自动把这段内容当成一张表。

也就是说，它脑内会补成：

```csvx
@table sheet
item,price,count
apple,3,5
banana,2,10
```

你可以把这个默认行为想成一个很勤快的小前台：

“你没写表名？没事，我先帮你叫它 `sheet`。”

这就让 CSVX 的起步门槛非常低。

---

## 🚀 最快得到结果：直接变成 `.xlsx`

如果你现在手里就有一个 `sales.csvx`：

```bash
csvx xlsx sales.csvx
```

它就会生成：

```text
sales.xlsx
```

这一步就是整个项目最核心的“魔术时刻”。

你交给它一份轻量文本表格，  
它最后还你一个 Excel 文件。

像不像你把一张手写菜单交给后厨，几分钟后端出来一桌菜。

---

## 📝 注释：先学会和未来的自己聊天

CSVX 使用 `#` 做单行注释。

```csvx
# 本周销售数据
item,price,count
apple,3,5
banana,2,10
```

你可以把注释当成贴在文件里的便利贴。

### 一个边界要记住

只要一整行在去掉前后空格后以 `#` 开头，这一行就会被忽略。

也就是说：

```csvx
# 这一行不会进表里
```

即便它真的可能是数据（比如写在 table 里面），编译器也会把它当成注释。

---

## 🧩 强类型：CSVX 给 CSV 装上的第一件装备

普通 CSV 有一个非常经典的问题：

**所有东西看起来都像字符串。**

比如：

```text
apple,1.99,3
```

你大概能猜出来：

- `apple` 是商品名
- `1.99` 是价格
- `3` 是数量

但“猜出来”和“说清楚”不是一回事。

CSVX 做的第一件增强，就是允许你直接在表头里声明类型：

```csvx
item[string],price[number],count[number]
apple,3,5
banana,2,10
```

这一行表头瞬间从“像猜谜语”变成了“像贴了标签的货架”：

- `item` 这一格放字符串
- `price` 这一格放数字
- `count` 这一格放数字

世界顿时文明了很多。

### 常见类型

- `string`
  - 例如：`apple`、`North`
- `number`
  - 例如：`1.99`、`3`
- `boolean`
  - 例如：`true`、`false`
- `null`
  - 例如：空单元格，像 `apple, ,3` 中间那个**空位**（即便它两头包含空格）
- `dynamic`
  - 例如：如果某列同时包含 `apple`、`true`、`3`，而且又不想强行把它声明成 `string`，那它就只能先保持 `dynamic`

值得注意的是，`dynamic` 是“列”的类型，不是“单元格”的类型。  
在 CSVX 里，单元格一旦被解析出来，就会落到某个明确类型上，它不会自己变成 `dynamic`。

---

### `dynamic` 列

如果写的是 `item[dynamic]`，CSVX 会按这个顺序尝试每一个单元格：

1. `null`
2. `number`
3. `boolean`
4. `string`

所以像这些值：

- `,,` 中间的空位会被当成 `null`
- `10` 会被当成数字（而不是字符串）
- `true` 会被当成布尔值（而不是字符串）
- `apple` 会被当成字符串（因为它只能是字符串）

这里有一个很重要、但也很好理解的小区别：

- `dynamic` 是“列”的声明状态
- `number / string / boolean / null` 是“单元格”真正解析出来的类型
- 单元格是忠于原数据的，解析出的类型永远不可能是 `dynamic`

也就是说：

- 即便列是 `dynamic`，其中的单元格仍然是强类型

可以把它想成：

- 列先说：“我这边先别急，我可能比较复杂”
- 但单元格还是会老老实实地回答：“我是数字”或者“我是字符串”

## 🌿 如果不写类型，会发生什么

### 自动类型推断

下面这种写法也是合法的：

```csvx
item,price,count
apple,3,5
banana,2,10
```

这时 CSVX 编译器会说：

“行，那我来猜。”

它会先把这一列（隐式）当成 `item[dynamic]`、`price[dynamic]`、`count[dynamic]` 这样的动态列。

因此一列值如果是：

```text
1
2
3
```

那么它们的单元格类型都会先被解析成 `number`。

### 后面还会发生什么：整列自动推断

如果这是一列**隐式 dynamic**，CSVX 还会在整列看完之后，再做一次自动推断。

规则很简单：

- 如果这一列的单元格最终都是同一种类型，就把整列收紧成那个类型
- 如果这一列里混着不同类型，就继续保持 `dynamic`

比如：

```csvx
price
1.99
2.50
3.00
```

这一列虽然一开始没有声明类型，但最后会被自动推断成 `price[number]`。

而如果是：

```csvx
mixed
1
true
apple
```

那这一列就会继续保持 `mixed[dynamic]`。

### 给新手的实用建议

非常简单：

- 你知道类型，就写出来
- 你只是先探索数据，不写也行

先别把类型系统想得太玄学。  
你可以把它理解成两步：

1. 先给每个单元格认类型
2. 再看看整列能不能收紧成更明确的类型

---

## 🧱 `@table`：给表起名字

如果你的文件开始变得认真一点了，就该给表一个正经名字。

```csvx
@table sales
item[string],price[number],count[number]
apple,3,5
banana,2,10
```

这相当于给这张表办了个工牌，名字叫 `sales`。

为什么有用？

因为后面的角色就能准确找到它：

- `@compute sales`
- `@window sales`
- `@plot sales`

如果你只有一个超小文件，不写 `@table` 也行。  
这时，文件开头那一块表会自动得到一个默认名字：`sheet`。

也就是说，这样的文件：

```csvx
item,price,count
apple,1.99,3
banana,0.99,5
```

在内部会被当成：

```csvx
@table sheet
item,price,count
apple,1.99,3
banana,0.99,5
```

但只要你开始加功能，还是建议尽早写上自己的表名。

---

## 🏷 名字该怎么取：合法标识符与同名冲突

写 CSVX 的时候，你会不断给东西起名字，比如：

- 表名
- 列名
- 函数名
- 插件别名
- 计算列名

这些名字都叫“标识符”。

### 什么样的名字是好名字

最稳妥的原则是：

- 开头用文字
- 后面可以跟文字、数字、下划线
- 名字尽量短，但要看得懂

比如这些都很好：

- `sales`
- `price`
- `discounted_total`
- `销售表`
- `含税总价`

### 一个简单建议

如果你是新手，先尽量遵守这条：

- 用能一眼看懂的名字
- 不要为了“简洁”发明太多缩写

像 `count` 就比 `qty` 更亲切，读者也不容易卡壳。

### 同名冲突是什么

同一种东西内部，最好不要重名。

例如：

- 两张表不要都叫 `sales`
- 两个函数不要都叫 `discounted`
- 两个插件别名不要都叫 `finance`

否则编译器就会问：

“你到底想让我用哪一个？”

这时候它不会替你猜，而是会直接报错。

## ➕ `@compute`：生成新列

现在来到 CSVX 最核心的能力之一：

**让表自己长出新列。**

先看一个最小示例：

```csvx
@table sales
price[number],count[number]
3,5
2,10

@compute sales
target: total[number]
total = price + count
```

它足够小，一眼就能懂。

### 这段在干什么

- `@compute sales`
  - 对 `sales` 这张表做计算
- `target: total[number]`
  - 声明新列 `total`，并把它作为计算结果嵌入表格
- `total = price + count`
  - 每一行都把 `price` 和 `count` 相加

你可以把 `@compute` 想成一个很老实的小会计：
它只看当前这一行，不东张西望。

### `target:` 不一定只能写一个

如果你想一次生成多个输出列，也可以：

```csvx
@compute sales
target: total[number], discounted_total[number]
total = price * count
discounted_total = total * 0.95
```

你可以把它理解成“表头风格的输出列声明”：

- 用逗号隔开
- 每个目标列都可以带类型

这样看起来会很整齐，也方便后面继续引用这些列。

### 最关键的心智模型

`@compute` 是 **逐行执行** 的。

也就是说：

- 这一行算这一行
- 不会看上一行
- 不会看下一行

它特别适合做普通的计算列。

像：

- 单价 × 数量
- 原价 - 折扣
- 两列相加

都很适合它。

---

## 🪜 `@compute` 里的局部变量：先算一步，再算一步

有时候一条公式太长，不好读。

这时可以先搞一个局部变量：

```csvx
@compute sales
target: total[number]
base[number] = price + count
total = base
```

这里：

- `base` 是临时变量
- `total` 才是最终输出列

你可以把它理解成做菜时先备料：

- 先把菜切好放碗里
- 再下锅

### 一条非常重要的默认规则

只有写在 `target:` 里的名字，才会真正成为表的新列。

这意味着：

- `total` 后面还能继续被引用
- `base` 只是块里的临时小帮手

这个规则很重要，真的很重要。  
后面你一旦写复杂一点的逻辑，就会靠它保持文件清爽。

---

## 🛠 `@func`：内联小函数，专门用来复用逻辑

当你发现自己开始重复写同一种表达式时，`@func` 就该登场了。

```csvx
@func discounted(price[number]) => number
return price * 0.95;
```

然后你在 `@compute` 里就能这样用：

```csvx
@compute sales
target: discounted_total[number]
discounted_total = discounted(price) * count
```

### 为什么先学 inline func

因为它是最自然的一步升级：

- 不需要额外文件
- 不需要外部路径
- 不需要先学插件

它就像你给一段常用操作起了个快捷方式。

比如你每天都要说：

“这杯饮料打九五折。”

你不想每天都重复讲一遍，于是你发明了一个词：

“折后价()”

这就是 `@func` 的感觉。

---

## 🔌 `@plugin`：如果 inline func 还不够，就请外援

有时候，本地写一个 `@func` 还不够。

比如你已经有一些 TypeScript 纯函数，想直接复用。  
这时就可以请外援，也就是 `@plugin`。

```csvx
@plugin finance
path: ./plugins/finance.ts
exports: tax
```

这里有三个角色：

- `finance`
  - 是你给这个插件起的别名，后面会写成 `finance.tax(...)`
- `path`
  - 是插件文件的位置
  - 如果写的是相对路径，它是**相对于当前 `.csvx` 文件本身**解析的
- `exports`
  - 表示你准备从这个插件里拿哪些导出出来用

### `tax` 必须是什么

它必须是一个函数。

因为你后面会像这样调用它：

```csvx
finance.tax(price)
```

如果 `tax` 不是函数，而是一个普通变量，编译器就会拦住你。

然后在计算里调用：

```csvx
@compute sales
target: taxed_total[number]
taxed_total = finance.tax(price)
```

### 这像什么

像你本来自己在店里算账，  
后来发现“税这件事还是让财务老师来吧”。

于是你直接调用财务插件。

### 什么时候该用插件

适合这些场景：

- 已经有现成 TS 纯函数
- 想跨多个文件复用逻辑
- 本地 `@func` 已经不够了

### 对新手的建议

第一天先别急着上插件。

你完全可以先这样学：

- 表格
- 强类型
- `@compute`
- `@func`

等这些顺了，再请外援。

---

## 🪟 `@window`：更强的跨行计算

如果说 `@compute` 是“看当前这一行”的小会计，  
那 `@window` 就像一个站得更高的统计员。

它会看整条队伍。

比如：

```csvx
@window sales
target: running_total[number]
running_total = cumsum(total)
```

这会生成一个累计列。

### 它为什么更强

因为它不只看一行。

它会看：

- 到目前为止累计了多少
- 上一行是谁
- 下一行是谁
- 在这一组里排第几

这类逻辑就不是 `@compute` 的主场了，  
而是 `@window` 的主场。

### `group:` 是干嘛的

如果你想“按组分别计算”，就加上 `group:`：

```csvx
@window sales
group: region
target: regional_running_total[number]
regional_running_total = cumsum(total)
```

这相当于说：

“别把所有地区混在一起，按地区各算各的。”

### `order:` 如果不写呢

CSVX 会默认按文件顺序来。

这点非常友好，因为它让最小 `@window` 示例还能保持很短。

---

## 📊 `@plot`：图表定义（Beta）

CSVX 也支持图表定义，不过这部分更适合先带着一个轻松的预期来理解：

**Beta**

也就是说，它已经可以使用，但还处在持续打磨的阶段。

一个最小示例是：

```csvx
@plot sales
deps: price,total
x: price
y: total
title: Price vs total
```

这段最适合被理解成一份“图表说明书”：

- 横轴是什么
- 纵轴是什么
- 标题是什么

CSVX 编译器目前不会直接把它变成一张现成图片。  
它会先把这段描述编译成 Vega-Lite 规格，并在导出的 `.xlsx` 中以结构化图表信息的形式保留下来。

如果把 Vega-Lite 想成“图表界的标准说明书格式”，这件事就会很好理解：

- CSVX 先写出“我要什么图”
- Vega-Lite 再负责把这个描述变成真正的图形

如果想直观看一眼 Vega-Lite 长什么样，可以先看看它的在线编辑器：

- [Vega-Lite Editor](https://vega.github.io/editor/#/examples/vega-lite/bar)

所以，当前的 `@plot` 更像“图表剧本”，而不是已经拍好的电影。

---

## 🎬 一个完整但不吓人的小故事

如果你想看一个“已经有点像真实项目，但还不难”的例子，可以看这个：

```csvx
# weekly sales
@table sales
item[string],price[number],count[number]
apple,3,5
banana,2,10
orange,4,6

@func discounted(price[number]) => number
return price * 0.95;

@compute sales
target: total[number], discounted_total[number]
total = price * count
discounted_total = discounted(price) * count

@plot sales
deps: price,total
x: price
y: total
title: Price vs total
```

这个文件已经能讲一个完整的小故事：

1. 先写原始数据
2. 再定义一个可复用的小函数
3. 再生成新列
4. 最后定义一个图表

你看，它其实没有想象中吓人。

---

## 🧠 新手最值得记住的默认行为

这里有几条默认行为，非常常见：

- 第一个 block 如果不以 `@` 开头  
  -> 会被当成隐式 `@table sheet`

- 不写类型  
  -> 默认是 `dynamic`

- `dynamic` 的解析顺序  
  -> `null -> number -> boolean -> string`

- `@compute` 中不在 `target:` 里的赋值  
  -> 是局部变量

- `@window` 不写 `group:`  
  -> 整张表视为一个组

- `@window` 不写 `order:`  
  -> 默认按文件顺序

不用第一天就把这些全背下来。  
你只要知道：CSVX 帮你做了不少“偷懒但合理”的默认处理。

---

## 😵 新手常见错误

### 错误 1：忘记写 `target:`

错误：

```csvx
@compute sales
total = price + count
```

正确：

```csvx
@compute sales
target: total[number]
total = price + count
```

因为 CSVX 需要先知道：  
“你到底想把哪个名字变成真正的列？”

---

### 错误 2：以为局部变量会自动进表

例如：

```csvx
@compute sales
target: total[number]
base[number] = price + count
total = base
```

这里的 `base` 不会自动变成表列。

它只是一个临时小助手。

如果你希望它成为真正的列，就把它写进 `target:`。

---

### 错误 3：第一天就把最难的功能全装上

这个也很常见。

很多人一上来就想同时搞：

- `@plugin`
- `@window`
- `@plot`

然后很快开始怀疑人生。

其实最舒服的节奏是：

1. 先写一个像 CSV 的表
2. 加类型
3. 加 `@compute`
4. 成功导出 `.xlsx`
5. 再慢慢升级

这样你会轻松很多。

---

## 🚀 推荐学习顺序

如果你是第一次接触 CSVX，我建议按这个顺序来：

1. 把 CSV 改成 `.csvx`
2. 给表头加类型
3. 用 `csvx xlsx` 导出
4. 给表写上 `@table`
5. 加一个最小 `@compute`
6. 学 `@func`
7. 不够时再用 `@plugin`
8. 需要跨行逻辑时再学 `@window`
9. 最后再看 `@plot`

这条路很稳，不容易把自己吓跑。

---

## 📚 接下来读什么

如果你读到这里，已经足够开始写第一个 CSVX 文件了。

下一步建议看：

- [REFERENCE.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.zh-CN.md)
- [BUILTINS.zh-CN.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.zh-CN.md)

前者像“语法字典”，  
后者像“内置函数菜单”。

而这份 Wiki，更像是带你把第一辆小自行车骑起来。
