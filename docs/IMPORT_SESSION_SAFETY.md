
## Correctness fixes — reimports and local tests (20 Nov 2026)

Importing another TT2 account now explicitly resets both contract runtime
scenarios, the optimistic contracts-at-max toggle, and pet/gear selections.
It keeps the imported skill tree, language, and intended playstyle. Before
this fix, a literal `\\n` inside a JavaScript `//` comment accidentally
commented out `state.contractMultiScenario=null;`, which could reuse the
previous player's or previous season's contract assumptions.

The Gemstones extension also shipped a test referencing
`equipmentEffectReduction` without importing it. Its test import has now
been corrected. Both fixes have dedicated regression tests that require
**local Node execution**, not GitHub Actions.
