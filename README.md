# TT2 Skill Tree Optimizer — Tap Titans 2 (8.4)

Free, open-source, mobile-first **Tap Titans 2 skill points calculator and TT2 skill tree optimizer**, maintained by [Leskasoft](https://www.leskasoft.fr/en).

> **Status: public preview (v0.1).** The solver is mathematically exact **for the stated weighted damage/gold proxy**, not necessarily for real gameplay. The underlying skill-tree table matches the latest skill CSV compared on 15 November 2026. Other game mechanics, equipment sets and live game changes require ongoing verification. No site is deployed until GitHub Pages is enabled.

## Features

- Import player or skill-tree **JSON** via clipboard, paste or file upload.
- Manual setup: SP, stage, damage/gold source, QoL preset, owned equipment, skill levels, exclusions and minimums.
- Six damage builds: Clan Ship, Pet, Shadow Clone, Heavenly Strike, Dagger, Gold Gun.
- Three styles: Fast Farm, Balanced and Push (these change the scoring weights and QoL presets, **not** a simulator of farming speed).
- Interactive allocation by tree, differences from current levels, TT2-format JSON export and shareable links.
- Works **entirely in the browser** with a module Web Worker: no account and no server-side player export processing.
- An exact dynamic program enforces skill-tree tier and parent prerequisites; cross-branch allocations are combined with a certified bounding technique rather than unchecked pruning.
- Numerical formulas evaluated in log10 space to avoid overflow on large game multipliers.

## Run locally

A local static server is needed for ES modules and Web Workers:

```sh
python -m http.server 8000
# open http://localhost:8000/
```

Alternatively, serve the directory with any local HTTP server. All code is plain JavaScript, HTML and CSS — no build step.

## Tests

Node.js 22 or later:

```sh
npm test
npm run check:data
```

The test suite includes property-like seeded cases comparing the solver against exhaustive enumeration, cross-branch convolution checks, source table validation, constraints, import/export and finite score checks. See [math audit](docs/MATH_AUDIT.md).

`check:data` downloads the current public TT2 skill CSV from the source data repository and compares all skill fields; run it when a game patch releases. It needs an Internet connection. It intentionally **does not automatically replace** the bundled data.

## Deploy with GitHub Pages

In **Settings → Pages** choose **Deploy from a branch**, branch `main`, folder `/(root)`. After merging the PR and enabling Pages, the site URL will be:

https://romainlsoft-bit.github.io/Leskasoft.TT2-SP-BUILD-OPTIMIZER/

Change `index.html` canonical/OG URLs if deploying under a different domain.

## Roadmap

- Independent compatibility checks for TT2 8.4+ active effects, equipment and clan technologies.
- Better conditional cross-skill synergy handling (contracts and other shared multipliers).
- Benchmarks at high SP, optimization progress reporting and optional exactness certification logs.
- Automated patch detection and reviewable data update PRs without blindly merging game changes.
- Progressive web app/offline support.

## Privacy and credits

The app runs the calculations locally. Player exports are not sent to Leskasoft. Settings may be saved in browser storage; shared links encode the configuration and **should be treated as public**.

The solver and data tables incorporate modified MIT-licensed third-party work; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the required attribution. Tap Titans 2 is the property of its respective owners; this is an independent, unofficial tool.

Other practical tools by [Leskasoft](https://www.leskasoft.fr/en) include [Remanence](https://remanence.leskasoft.fr), a solution for exploring and recovering damaged or corrupted video files.

### High-SP support

The accepted skill-point budget is **0–50,000**. Exact optimization is performed in a Web Worker and may require substantial memory/time on phones at high budgets. Raising the input limit does not constitute a 50,000-SP performance benchmark or proof of an exact real-game optimum. See [math audit](docs/MATH_AUDIT.md).
