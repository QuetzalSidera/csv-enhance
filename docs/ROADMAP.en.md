# Roadmap

CSVX already covers a solid end-to-end path:

- write `.csvx`
- define strongly typed tables
- create computed columns
- reuse local `@func` and external `@plugin`
- generate window columns
- export `.xlsx`
- work with first-pass editor support in VS Code

The next stage is not just “add more features.”

The real goal is to make CSVX steadily become a format that is:

- easier to write
- easier to read
- easier to use
- better suited for editors and AI collaboration

---

## 1. Near-Term Priorities

These are the most valuable short-term directions.

### 1.1 Keep improving `@plot`

`@plot` already works, but it still feels like an early prototype.

Near-term goals:

- support more chart types beyond bar
- improve the ergonomics of `deps / x / y / color / title`
- provide clearer diagnostics and better defaults
- make plot output more stable for downstream front-end consumers

### 1.2 Image rendering

Today, `@plot` mainly produces Vega-Lite specs and `_plots` metadata.

Future goals:

- render `@plot` into actual image outputs
- support export targets such as PNG and SVG
- explore image embedding or richer chart presentation in `.xlsx`

This matters because it moves CSVX from “able to describe charts” toward “able to produce charts.”

### 1.3 Richer and friendlier syntax

CSVX should not become another large, heavy language.

The direction is:

**make common things feel more natural to express.**

That includes:

- shorter, more intuitive block syntax
- more helpful defaults
- less boilerplate in common expressions
- clearer naming and field design

The goal is not cleverness.  
The goal is reducing friction for first-time users.

### 1.4 Continue improving the editor experience

VS Code already has a strong first version, but there is room to grow:

- smarter completion
- richer hover information
- more complete go to definition / references
- rename
- quick fix / code action
- diagnostics that feel closer to a mature language toolchain

---

## 2. Editor Ecosystem

CSVX should not feel good in only one editor.

### 2.1 IDEA / JetBrains editor support

Today the main editor integration is VS Code.

The next worthwhile step is:

- IntelliJ IDEA / WebStorm / PyCharm syntax highlighting
- basic diagnostics integration
- early hover / definition support

This would make CSVX much more practical for teams that live in JetBrains tools.

### 2.2 A more general language service

As editor features continue to grow, it will make sense to move toward:

- a more stable language-service layer
- broader LSP (Language Server Protocol) support

That would open the door to more than just VS Code and IDEA.

---

## 3. Language Capability Expansion

These directions will shape how much spreadsheet logic CSVX can express cleanly.

### 3.1 Continue growing `@window`

`@window` already supports a useful first batch of window functions.

Next steps may include:

- richer window builtins
- more flexible grouping and ordering
- clearer debugging for sequence-aware logic
- friendlier syntax sugar for common patterns

### 3.2 More built-in functions

Today CSVX already includes:

- `if`
- `coalesce`
- `and`
- `or`
- `lag`
- `lead`
- `cumsum`
- `rank`

Future directions include:

- more string functions
- more numeric functions
- more date/time functions
- easier data-cleaning helpers

That will reduce the number of cases that currently require plugins.

### 3.3 A more mature type system

CSVX already has a solid strong-typing foundation, but it can go further:

- clearer shape/type rules and documentation
- smarter type diagnostics
- more complete inference
- stronger checking for function parameters and return values

The goal is a type system that is reliable without scaring off new users.

### 3.4 Aggregation and higher-level data features

CSVX already has row-scoped `@compute` and sequence-scoped `@window`.

Future exploration may include:

- more natural aggregation support
- blocks better suited for summary/statistics workflows
- multi-table workflows
- join / merge / reshape style operations

These features are valuable, but they need to be introduced carefully so CSVX does not lose its lightweight and readable character.

---

## 4. Output and Integration

CSVX is valuable not only because it can be written nicely, but because it can connect to real outputs.

### 4.1 Stronger `.xlsx` export

The current `.xlsx` export works, but can be improved further:

- richer worksheet formatting
- better metadata sheets
- workbook structures that feel closer to real spreadsheet workflows
- exploration of native charts or embedded images

### 4.2 More output targets

Future output directions may include:

- JSON export
- HTML preview pages
- static chart artifacts
- intermediate formats for front-end or back-end pipelines

### 4.3 A more complete CLI experience

The CLI already supports the core flow.

Next improvements could include:

- friendlier command help
- clearer summaries
- easier batch processing
- modes that feel better in CI environments

---

## 5. AI Friendliness

One of CSVX’s distinctive goals is that it should work well not only for humans, but also for AI systems that generate or edit tables.

This is worth long-term investment.

### 5.1 More stable generation patterns

Goals include:

- less syntax that is easy to get wrong
- less ambiguity
- shorter but still readable forms
- more stable block structures

### 5.2 Diagnostics that are easier for AI to repair

Future improvements may include:

- more direct suggestions
- diagnostics that are easier to auto-fix
- error styles that help a model understand “what to change” at a glance

### 5.3 Continued lint-rule growth

CSVX already has lint and diagnostics foundations.

Future rules can continue to improve:

- maintainability
- AI-generated output quality
- team-level consistency

---

## 6. Engineering and Ecosystem Work

These are not always the flashiest tasks, but they strongly influence how far the project can go.

### 6.1 Continue growing the documentation system

CSVX already has:

- a beginner wiki
- reference docs
- builtins documentation
- CLI documentation
- type-system notes

Further work may include:

- more structured tutorials
- a richer cookbook / recipes section
- an FAQ
- a dedicated overview page for demos and sharing

### 6.2 Expand the example library

High-quality examples matter a lot.

Useful additions would include:

- more realistic business-style datasets
- more Chinese examples
- more multilingual examples
- more `@window` examples
- more examples that combine plugins and `@func`

### 6.3 Keep thickening the test suite

The current test suite already covers a lot of the core path, but more coverage is still valuable:

- more edge cases
- more editor scenarios
- more CLI scenarios
- more consistency checks across docs and examples

---

## 7. Known Limitations

These limitations still exist today and should continue to be improved.

### 7.1 Comment handling is still coarse around table content

Any whole trimmed line starting with `#` is treated as a comment.

That means:

- if a full table row begins with `#` after trimming
- it will currently be treated as a comment instead of data

This rule is convenient most of the time, but still too coarse for certain edge cases.

### 7.2 `@plot` is still prototype-shaped

Even though it works:

- chart coverage is still limited
- the rendering pipeline is still incomplete
- the output experience still needs refinement

### 7.3 Editor support is not broad enough yet

VS Code is the main supported editor today.  
JetBrains / IDEA support is not yet in place.

---

## 8. A Longer-Term Goal

CSVX is not just “another spreadsheet format.”

The longer-term direction is for it to become a bridge format that is:

- comfortable for humans to write
- comfortable for AI to edit
- executable by software
- exportable into traditional spreadsheet outputs

If that succeeds, CSVX starts to look like a kind of intermediate language for tables:

- light
- clear
- extensible
- compilable

That is what makes the project especially interesting.

