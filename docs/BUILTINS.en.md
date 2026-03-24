# CSVX Builtins

This document describes the builtin expression functions currently available in CSVX.

Builtin functions are the functions you can use directly:

- without `@plugin`
- without extra files
- without external setup

One thing matters more than anything else:

**not every builtin is valid in every block.**

Some builtins are general-purpose.  
Some are window-only.

---

## Quick Overview: Where Builtins Can Be Used

### General builtins

These can be used in:

- `@compute`
- `@func`
- `@window`

They are:

- `if`
- `coalesce`
- `and`
- `or`

### Window-only builtins

These can only be used in `@window`:

- `current`
- `lag`
- `lead`
- `first`
- `last`
- `row_number`
- `rank`
- `cumsum`

If one of these is written inside `@compute` or `@func`, the CSVX compiler will reject it.

---

## `if`

### Purpose

Choose between two values based on a condition.

### Form

```csvx
if(condition, thenValue, elseValue)
```

### Example

```csvx
level = if(price > 10, "high", "low")
```

### Mental model

It is a fork in the road:

- if the condition is true, go left
- otherwise, go right

### Allowed contexts

- `@compute`
- `@func`
- `@window`

---

## `coalesce`

### Purpose

Return the first non-null value.

### Form

```csvx
coalesce(value, fallback, ...)
```

### Example

```csvx
final_price = coalesce(discount_price, original_price, 0)
```

### Mental model

It is like asking several people in order:

- do you have the answer?
- no? next
- first useful answer wins

### Allowed contexts

- `@compute`
- `@func`
- `@window`

---

## `and`

### Purpose

Return `true` only when every argument is `true`.

### Form

```csvx
and(a, b, ...)
```

### Example

```csvx
valid = and(enabled, reviewed)
```

### Mental model

Like two security guards at a door:

- one yes is not enough
- everyone has to say yes

### Allowed contexts

- `@compute`
- `@func`
- `@window`

---

## `or`

### Purpose

Return `true` when any argument is `true`.

### Form

```csvx
or(a, b, ...)
```

### Example

```csvx
available = or(in_stock, pre_order)
```

### Mental model

Like several entrances:

- if any one of them works, you can get in

### Allowed contexts

- `@compute`
- `@func`
- `@window`

---

## `current`

### Purpose

Return the current-row value of a column inside window logic.

### Form

```csvx
current(column)
```

### Example

```csvx
current_amount = current(amount)
```

### Mental model

You are standing in the queue and asking:

“what is the value for the person currently in front of me?”

### Allowed contexts

- `@window` only

---

## `lag`

### Purpose

Return the value from the previous row in the same window group.

### Form

```csvx
lag(column, offset?)
```

### Example

```csvx
previous_amount = lag(amount, 1)
```

### Mental model

It is like looking one person back in the queue.

### Allowed contexts

- `@window` only

---

## `lead`

### Purpose

Return the value from the next row in the same window group.

### Form

```csvx
lead(column, offset?)
```

### Example

```csvx
next_amount = lead(amount, 1)
```

### Mental model

It is like looking one person ahead in the queue.

### Allowed contexts

- `@window` only

---

## `first`

### Purpose

Return the first value in the current window group.

### Form

```csvx
first(column)
```

### Example

```csvx
first_amount = first(amount)
```

### Mental model

It answers:

“who is first in this group?”

### Allowed contexts

- `@window` only

---

## `last`

### Purpose

Return the last value in the current window group.

### Form

```csvx
last(column)
```

### Example

```csvx
last_amount = last(amount)
```

### Mental model

It answers:

“who is last in this group?”

### Allowed contexts

- `@window` only

---

## `row_number`

### Purpose

Return the current row position inside the window group, starting at `1`.

### Form

```csvx
row_number()
```

### Example

```csvx
row_id = row_number()
```

### Mental model

Like handing out queue numbers:

- first person gets 1
- second person gets 2
- third person gets 3

### Allowed contexts

- `@window` only

---

## `rank`

### Purpose

Return the current row rank in the active window order, starting at `1`.

### Form

```csvx
rank()
```

### Example

```csvx
rank_value = rank()
```

### Mental model

This is the “position on the leaderboard” function.

### Allowed contexts

- `@window` only

---

## `cumsum`

### Purpose

Return the cumulative sum of a numeric column.

### Form

```csvx
cumsum(column)
```

### Example

```csvx
running_amount = cumsum(amount)
```

### Mental model

Like keeping a running tab:

- first person spent 10
- second person spent 20
- by the second person, the running total is 30

### Allowed contexts

- `@window` only

---

## One Important Reminder

Editors may syntax-highlight all builtin names, but:

- highlighting does not mean “valid everywhere”

The final rule is enforced by the compiler.

So if this appears in `@compute`:

```csvx
running_total = cumsum(total)
```

the editor may still color `cumsum` like a builtin,  
but the compiler will still report:

“this function is only allowed inside `@window`.”

