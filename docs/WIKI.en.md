# CSVX Beginner Wiki

Welcome to CSVX.

No stress: this is not one of those projects where you need three pages of jargon before you are allowed to continue.

A very human description is:

**CSVX is a smarter CSV and a lighter spreadsheet format.**

If you want the short version:

CSVX is a plain-text spreadsheet format that tries to be:

- friendly to people
- friendly to AI
- lightweight
- easy to extend

If you want the full syntax catalog, go here:

- [REFERENCE.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.en.md)

This guide is not trying to be a dictionary.  
It is trying to feel like a calm first walkthrough.

---

## 🌱 What Is This Project, Really?

Let’s say it in normal language.

CSVX exists because:

- CSV is simple, but too bare
- Excel is powerful, but heavy and opaque
- `.xlsx` is not a fun thing for AI or Git to read directly

So CSVX steps in and says:

“Maybe we can keep the file light, but still let it think a little.”

That makes it:

- as light as CSV
- smarter than CSV
- easier to inspect than Excel
- still able to compile to `.xlsx`

You can think of it as:

**a lightweight, extensible, text-first spreadsheet**

---

## 🎬 Start with CSV, Not with the Scary Parts

The easiest way to understand CSVX is not to start with `@window` or `@plugin`.

Start with a normal CSV.

For example:

```text
item,price,count
apple,3,5
banana,2,10
```

Everyone understands this.

It is basically a tiny shopping list:

- item
- price
- quantity

CSVX looks at this and says:

“Great. Let’s keep that. I’ll just add a few useful superpowers.”

That means CSVX is compatible with CSV.

So yes:

- you can begin with the simplest table
- you do not need to learn the whole DSL on day one

---

## 🧩 Your First Minimal Example

Start here:

```csvx
item,price,count
apple,3,5
banana,2,10
```

This is already valid CSVX.

Why?

Because if the file does not start with an explicit directive, CSVX quietly treats it as a table.

In its head, it becomes:

```csvx
@table sheet
item,price,count
apple,3,5
banana,2,10
```

You can imagine a helpful front-desk worker saying:

“No table name? No problem, I’ll call it `sheet` for now.”

That default keeps the entry point wonderfully low.

---

## 🚀 The Fastest Useful Result: Turn It into `.xlsx`

If your file is named `sales.csvx`, just run:

```bash
csvx xlsx sales.csvx
```

CSVX will generate:

```text
sales.xlsx
```

That is the core “magic moment” of the project.

You hand it a lightweight text table, and it gives you back an Excel file.

Like handing in a napkin sketch and getting back an organized spreadsheet.

---

## 📝 Comments: Talk to Future You

CSVX uses `#` for line comments.

```csvx
# weekly sales
item,price,count
apple,3,5
banana,2,10
```

Comments are basically sticky notes inside the file.

### One boundary to remember

If a whole trimmed line starts with `#`, CSVX ignores it.

So this:

```csvx
# this row is ignored
```

is treated as a comment even if, in theory, it could have been table data.

---

## 🧩 Strong Typing: The First Real Upgrade over CSV

Plain CSV has a classic problem:

**everything looks like text**

For example:

```text
apple,1.99,3
```

You can guess what that means:

- `apple` is probably an item
- `1.99` is probably a price
- `3` is probably a count

But “probably” is not the same thing as “clearly declared”.

CSVX improves this by letting you write types right in the header:

```csvx
item[string],price[number],count[number]
apple,3,5
banana,2,10
```

This is like putting clear labels on storage boxes:

- text goes here
- numbers go here
- more numbers go here

Suddenly the file stops being a guessing game.

### Common types

- `string`
  - for values like `apple` or `North`
- `number`
  - for values like `1.99` or `3`
- `boolean`
  - for values like `true` or `false`
- `null`
  - for an empty cell, like the blank middle slot in `apple,,3`
- `dynamic`
  - for “let the compiler infer it”

---

## 🌿 What Happens If You Omit the Type?

### Automatic type inference

This is still valid:

```csvx
item,price,count
apple,3,5
banana,2,10
```

In that case, CSVX says:

“Alright, I’ll try to figure it out.”

That means the column is treated, at least for now, as something like `item[dynamic]`, `price[dynamic]`, or `count[dynamic]`.

### Default `dynamic` parsing order

CSVX tries each cell in this order:

1. `null`
2. `number`
3. `boolean`
4. `string`

So for values like these:

- `10` becomes a number
- `true` becomes a boolean
- `apple` becomes a string

There is one small but important distinction here:

- `dynamic` is the column's declared state
- `number / string / boolean / null` are the actual parsed cell types

In other words:

- a column may start out as `dynamic`
- but each individual cell is still parsed into a concrete type

For example, if a column contains:

```text
1
2
3
```

those cells are all parsed as `number`.

### What happens next: whole-column inference

If the column is an **implicit dynamic** column, CSVX then does one more pass at the whole column.

The rule is simple:

- if every parsed cell ends up with the same type, the whole column is inferred to that type
- if the column mixes different types, it stays `dynamic`

For example:

```csvx
price
1.99
2.50
3.00
```

This column starts without an explicit type, but it will finally be inferred as `price[number]`.

But if the column looks like this:

```csvx
mixed
1
true
apple
```

then it stays `mixed[dynamic]`.

### Good beginner advice

Very simple:

- if you know the type, write it
- if you are just exploring, leaving it dynamic is fine

You do not need to turn this into philosophy.  
The easiest way to think about it is:

1. first, each cell gets parsed
2. then the column may be tightened into a more specific type

---

## 🧱 `@table`: Give the Table a Name

Once your file grows a little, it is a good idea to name the table explicitly.

```csvx
@table sales
item[string],price[number],count[number]
apple,3,5
banana,2,10
```

Now the table has a proper identity card: `sales`.

Why does that matter?

Because later blocks can find it:

- `@compute sales`
- `@window sales`
- `@plot sales`

If your file is tiny, the implicit table is fine.  
In that case, the first table block automatically gets the default name `sheet`.

So this file:

```csvx
item,price,count
apple,1.99,3
banana,0.99,5
```

is treated internally as:

```csvx
@table sheet
item,price,count
apple,1.99,3
banana,0.99,5
```

But once you start adding logic, naming the table explicitly is still the better move.

---

## 🏷 What Counts as a Good Name: Identifiers and Name Conflicts

In CSVX, you keep naming things:

- tables
- columns
- functions
- plugin aliases
- computed columns

These names are called identifiers.

### What makes a good identifier

The safest rule is:

- start with a word
- then keep using words, numbers, or underscores
- keep it short, but keep it readable

These are all good examples:

- `sales`
- `price`
- `discounted_total`
- `销售表`
- `含税总价`

### A very practical beginner tip

Use names that are easy to understand at first glance.

For example, `count` is friendlier than `qty` for many readers.

Shorter is not always clearer.

### What is a name conflict?

Within the same kind of thing, names should not collide.

For example:

- two tables should not both be named `sales`
- two functions should not both be named `discounted`
- two plugin aliases should not both be named `finance`

Otherwise the compiler has to ask:

“Which one did you mean?”

And instead of guessing, it reports an error.

## ➕ `@compute`: Create New Columns

Now we arrive at one of the core CSVX superpowers:

**growing new columns from existing ones**

Here is a tiny example:

```csvx
@table sales
price[number],count[number]
3,5
2,10

@compute sales
target: total[number]
total = price + count
```

It is small enough that you can understand it immediately.

### What is happening here?

- `@compute sales`
  - do calculations for table `sales`
- `target: total[number]`
  - declare one new output column named `total`
- `total = price + count`
  - for each row, add `price` and `count`

You can think of `@compute` as a very honest little accountant:

it only looks at the current row and does not peek left and right.

### `target:` can declare more than one output

You do not have to declare only one output column.

This is also valid:

```csvx
@compute sales
target: total[number], discounted_total[number]
total = price * count
discounted_total = total * 0.95
```

You can read `target:` like a mini header row:

- separate names with commas
- give each output column a type if you want to

This keeps multi-column compute blocks neat and easy to scan.

### The most important mental model

`@compute` is **row-scoped**.

That means:

- this row is calculated from this row
- it does not look at the previous row
- it does not look at the next row

It is perfect for normal computed columns like:

- price × quantity
- original price - discount
- adding two columns

---

## 🪜 Local Variables in `@compute`: One Step, Then Another

Sometimes one expression is too long to read comfortably.

So you can introduce a local:

```csvx
@compute sales
target: total[number]
base[number] = price + count
total = base
```

Here:

- `base` is temporary
- `total` is the real output column

Think of it like cooking:

- first prep the ingredients
- then finish the dish

### One very important default rule

Only names listed in `target:` become real table columns.

That means:

- `total` can be reused later
- `base` is just a temporary helper inside the block

This rule is quietly one of the most important rules in the whole language.

---

## 🛠 `@func`: Tiny Inline Functions for Repeated Logic

Once you start repeating the same expression, `@func` becomes useful.

```csvx
@func discounted(price[number]) => number
return price * 0.95;
```

Then you can call it in `@compute`:

```csvx
@compute sales
target: discounted_total[number]
discounted_total = discounted(price) * count
```

### Why teach inline functions before plugins

Because this is the natural “next step up”:

- no extra file
- no extra path
- no external dependency

It is basically a named reusable bit of logic.

Like inventing a shortcut phrase for something you say all the time.

---

## 🔌 `@plugin`: Bring in Outside Help When Local Functions Are Not Enough

Sometimes local `@func` is not enough.

Maybe you already have TypeScript utility functions you want to reuse.

That is where plugins come in:

```csvx
@plugin finance
path: ./plugins/finance.ts
exports: tax
```

There are three moving parts here:

- `finance`
  - the alias you give the plugin
  - later you call it like `finance.tax(...)`
- `path`
  - where the plugin file lives
  - if it is relative, it resolves relative to the current `.csvx` file
- `exports`
  - which exported names you want to use from that file

### What must `tax` be?

It must be a function.

Because later you will call it like this:

```csvx
finance.tax(price)
```

If `tax` is not a function, the compiler will stop you.

Then call them:

```csvx
@compute sales
target: taxed_total[number]
taxed_total = finance.tax(price)
```

### What this feels like

It is like running a shop yourself, then deciding:

“Actually, tax calculation should go to the finance expert.”

So you call the finance plugin.

### When plugins are a good idea

Good cases:

- you already have TS pure functions
- you want reuse across files
- local `@func` is no longer enough

### Beginner advice

Do not start with plugins.

Start with:

- tables
- types
- `@compute`
- `@func`

That path is much friendlier.

---

## 🪟 `@window`: Stronger Cross-Row Logic

If `@compute` is the accountant who only looks at one order at a time,  
`@window` is the person standing above the whole queue.

It can see relationships across rows.

For example:

```csvx
@window sales
target: running_total[number]
running_total = cumsum(total)
```

This creates a running total column.

### Why this is more advanced

Because now we are no longer asking:

“What is true for this row alone?”

We are asking:

- how much has accumulated so far?
- what was the previous row?
- what is the next row?
- what rank is this row in the group?

That is window logic.

### What `group:` does

If you want separate calculations by category, add `group:`:

```csvx
@window sales
group: region
target: regional_running_total[number]
regional_running_total = cumsum(total)
```

That means:

“Do not mix all regions together. Calculate each region separately.”

### What if `order:` is omitted?

CSVX uses file order by default.

That is a very kind default because it keeps the smallest window examples short.

---

## 📊 `@plot`: Plot Definitions (Beta)

CSVX can also describe plots, but it helps to approach this part with the right expectation:

**beta**

That means it is usable today, but still actively evolving.

A minimal plot looks like this:

```csvx
@plot sales
deps: price,total
x: price
y: total
title: Price vs total
```

The easiest way to read this block is as a chart instruction sheet:

- what goes on the x-axis
- what goes on the y-axis
- what title to show

Today, the CSVX compiler does not turn this directly into a finished image.  
Instead, it compiles the description into a Vega-Lite spec and preserves it in exported `.xlsx` output as structured chart metadata.

If Vega-Lite is treated as “a standard format for describing charts,” the idea becomes much easier:

- CSVX writes down what chart you want
- Vega-Lite is the format that carries that description forward

If you want to see what Vega-Lite looks like in practice, its online editor is a good place to peek:

- [Vega-Lite Editor](https://vega.github.io/editor/#/examples/vega-lite/bar)

So for now, `@plot` is best thought of as a chart script rather than a final rendered picture.

---

## 🎬 A Complete Example That Still Feels Friendly

If you want one file that already looks like a real project but still stays approachable, use this:

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

This file already tells a full little story:

1. write raw data
2. define one reusable helper
3. generate new columns
4. describe a plot

And that is enough to feel like a real system, not just a toy.

---

## 🧠 Defaults Worth Remembering

These defaults show up all the time:

- first block without `@`  
  -> implicit `@table sheet`

- omitted type  
  -> `dynamic`

- `dynamic` parsing order  
  -> `null -> number -> boolean -> string`

- assignments in `@compute` that are not listed in `target:`  
  -> locals

- `@window` without `group:`  
  -> one whole-table group

- `@window` without `order:`  
  -> file order

You do not need to memorize them instantly.  
Just know that CSVX has a lot of sensible “helpful defaults.”

---

## 😵 Common Beginner Mistakes

### Mistake 1: forgetting `target:`

Wrong:

```csvx
@compute sales
total = price + count
```

Right:

```csvx
@compute sales
target: total[number]
total = price + count
```

CSVX needs to know:

“Which names are real output columns?”

---

### Mistake 2: expecting locals to become table columns automatically

Example:

```csvx
@compute sales
target: total[number]
base[number] = price + count
total = base
```

Here `base` is not a final column.

It is just a temporary helper.

If you want it to become a real column, put it in `target:`.

---

### Mistake 3: trying to learn the hardest features first

It is very tempting to jump straight into:

- `@plugin`
- `@window`
- `@plot`

Then the file starts feeling much harder than it really is.

A smoother order is:

1. start with CSV-like data
2. add types
3. add one `@compute`
4. successfully export `.xlsx`
5. then level up

That keeps the project friendly.

---

## 🚀 Recommended Learning Order

If this is your first CSVX project, this order works really well:

1. rename CSV to `.csvx`
2. add header types
3. export with `csvx xlsx`
4. add `@table`
5. add one minimal `@compute`
6. learn `@func`
7. add `@plugin` only if needed
8. learn `@window` for cross-row logic
9. explore `@plot` last

That path is steady and kind to your brain.

---

## 📚 What To Read Next

If you made it this far, you already know enough to write a first real CSVX file.

Next good reads:

- [REFERENCE.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/REFERENCE.en.md)
- [BUILTINS.en.md](/Users/qianshuang/Project/WebProject/csv-enhance/docs/BUILTINS.en.md)

The reference is your syntax dictionary.  
The builtins doc is your function menu.

And this wiki?  
This one was just here to help you get the bike moving without falling over immediately.
