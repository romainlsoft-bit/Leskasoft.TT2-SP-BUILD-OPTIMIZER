# TT2 Skill Tree Optimizer — Tap Titans 2 (8.4)

Free, open-source, mobile-first **Tap Titans 2 skill points calculator and TT2 skill tree optimizer**, maintained by [Leskasoft](https://www.leskasoft.fr/en).

> **Status: public preview (v0.1).** The solver is exact per branch for its weighted damage/gold proxy; cross-branch allocations above 12,000 SP use a certified bounded approximation. This does **not** establish the best real gameplay build. The underlying skill-tree table matches the latest skill CSV compared on 15 November 2026. Other game mechanics, equipment sets and live game changes require ongoing verification. Hosting and DNS availability must be verified independently after publication.

## Export-version compatibility

The source skill-tree catalogue is validated against **TT2 8.4.0** (source
dataset revision **2026-09-18**). This does **not** certify the model's other
account effects, conditional bonuses or seasonal rules against every TT2
version. The app now evaluates the `Version` supplied in player exports:

- `8.4.0`: the skill-tree catalogue version matches.
- Newer versions (for example `8.4.1` or `8.4.2`): import is allowed for
  inspection, but the app warns that gameplay compatibility is not fully
  verified. It does **not** silently upgrade the export version of generated
  builds or claim that all account mechanics are validated.
- Older or unrecognized versions: the app warns that the skill-tree mapping
  has not been validated; absent version metadata remains unknown.

The Transcendence season-14 start is dated **26 November 2026 UTC** in one
canonical source policy. The 180,000 stage figure is a Transcendence entry
threshold, not a season-14 stage ceiling. Old seasonal account power is
excluded unless the imported account supplies qualifying current-season
evidence. The public automatic pet mode chooses one source-ranked owned pet
per equipment slot, not an exhaustive pet-pair comparison.

## Features

- Import player or skill-tree **JSON** via clipboard, paste or file upload.
- Manual setup: SP, stage, damage/gold source, QoL preset, owned equipment, skill levels, exclusions and minimums.
- Six damage builds: Clan Ship, Pet, Shadow Clone, Heavenly Strike, Dagger, Gold Gun.
- Three styles: Fast Farm, Balanced and Push (these change the scoring weights and QoL presets, **not** a simulator of farming speed).
- Interactive allocation by tree, differences from current levels, TT2-format JSON export and shareable links.
- Works **entirely in the browser** with a module Web Worker: no account and no server-side player export processing.
- Supports budgets of **up to 50,000 Skill Points** with compact per-branch states, a progress indicator and a cancel control. Above 12,000 SP the grid combination is bounded rather than globally exact. Performance on mobile hardware is not guaranteed.
- An exact dynamic program enforces skill-tree tier and parent prerequisites. Up to 12,000 SP, cross-branch optimization uses exact convolution. Above 12,000 SP, each branch remains exact, while branch combinations use a **bounded grid optimizer with a mathematically certified upper bound on the model-score gap**. The UI clearly labels approximate solutions.
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

`check:data` compares bundled game data with the independently extracted TT2 8.4 Unity snapshot. It runs offline and does not automatically fetch or replace game data.

## Deploy with GitHub Pages

In **Settings → Pages** choose **Deploy from a branch**, branch `main`, folder `/(root)`; add `tap-titans.leskasoft.com` as the Custom domain, then enable Enforce HTTPS when available. Configure the DNS CNAME `tap-titans` → `romainlsoft-bit.github.io` (without the repository path). After enabling Pages, the intended site URL is:

https://tap-titans.leskasoft.com/

Change `index.html` canonical/OG URLs if deploying under a different domain.

## Roadmap

- Independent compatibility checks for TT2 8.4+ active effects, equipment and clan technologies.
- Better conditional cross-skill synergy handling (contracts and other shared multipliers).
- Browser/mobile benchmarks at high SP and further memory/solver optimizations.
- Automated patch detection and reviewable data update PRs without blindly merging game changes.
- Progressive web app/offline support.

## Privacy and credits

The app runs the calculations locally. Player exports are not sent to Leskasoft. Settings may be saved in browser storage; shared links encode the configuration and **should be treated as public**.

The solver and data tables incorporate modified MIT-licensed third-party work; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the required attribution. Tap Titans 2 is the property of its respective owners; this is an independent, unofficial tool.

Other practical tools by [Leskasoft](https://www.leskasoft.fr/en) include [Remanence](https://remanence.leskasoft.fr), a solution for exploring and recovering damaged or corrupted video files.

### 50,000-SP numerical validation

For a 50,000-SP Clan Ship / Fairy Gold build without QoL floors, the bounded model returned 49,973 SP allocated, using a 20-SP grid and a **1.2556 log10-score-unit worst-case upper gap** against the exact modeled optimum. In a JavaScript execution benchmark the calculation took approximately 17.4 seconds. This is an implementation test, **not a mobile performance guarantee** or validation of actual in-game damage.

The certification is for the declared additive weighted score **only**; new TT2 8.4 equipment effects and conditional interactions still require independent verification.

## Interface languages and accessibility

The interface is available in **English (default), French, Ukrainian and Russian**. Players can switch languages in the header; the selection is remembered locally. The translations are also served as directly indexable HTML at `/fr/`, `/uk/` and `/ru/`; the English root `/` is the default. Legacy `?lang=...` links navigate to the appropriate language-specific path. Internal skill identifiers and export JSON remain untranslated so the game can still import them.

The three steps (account, playstyle, result) are full-width and vertically stacked on desktop and mobile. An accessible “?” help dialog next to Step 1 explains where the in-game export command is located. All game calculations and algorithms remain unchanged by localization.

## Licenses and acknowledgements

This repository is distributed under the [MIT License](LICENSE), © 2026 romainlsoft-bit. The third-party code and reference tables adapted from [rawrzcookie's original TT2 optimizer](https://github.com/rawrzcookie/rawrzcookie.github.io) retain its original 2022 copyright and MIT permission notice in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Both notices must be kept in copies or substantial portions of redistributed code.

## 22,000+ SP review and search indexing

A reproducible high-SP benchmark is available:

```sh
npm run bench:22k
# or: node scripts/benchmark-22k.mjs 22500 --all
```

In a JavaScript execution environment on 16 November 2026, two 22,500-SP reference configurations completed in approximately **10.5 seconds** (Clan Ship/Fairy/QoL) and **17.3 seconds** (Shadow Clone/Fairy/no QoL), respectively. Both respected the SP limit and returned bounded model-score gaps. These measurements **do not predict performance on Android**. Do not commit game exports with account or personal data to this repository.

Static translated HTML, one factual H1 per language, self-canonical URLs, reciprocal hreflang, a four-language sitemap and factual methodology content are supplied for crawling. The site deliberately avoids star ratings or review statistics that cannot be substantiated. Google Search Console verification and actual indexing cannot be carried out from source code alone. See [SEO and indexing checklist](docs/SEO_INDEXING.md).

## Model limitation and measured Pet/Fairy regression (issue #9)

A player reported a build **750 stages better** than the optimizer's previous output with almost identical SP (22,640 vs 22,642). This is evidence of a gameplay-model problem or incompatible optimization settings, not a reason to lock branch budgets to their old values. Some temporary effects were previously scored without checking activation: Hayst (Quick Fortune), Snap (Philosopher's Flux) and five Astral Awakening orb taps. The current public optimizer instead assumes ideal boss-push conditions (including Hayst and Snap); Astral Awakening uses five orbs only when the skill is present. These assumptions do not establish simultaneous availability or real damage.

These changes do **not** establish a guaranteed in-game improvement or close issue #9. Compare real game outcomes. See [mathematical audit](docs/MATH_AUDIT.md).


## SP budget regression fix (November 2026)

The retired score-per-SP ratio setting could allocate just a handful of points even when a player owned more than 22,000 SP. The calculator now always maximizes **total modeled score within the entered budget**; old persisted/share-linked ratio settings cannot reactivate the previous behavior. The 22k+ Pet/Fairy benchmark is available with `node scripts/benchmark-22k.mjs 22642 --all`. This does not resolve the separate validation of in-game stages tracked in issue #9.

## Verify locally without GitHub Actions

GitHub Actions was deliberately removed from the development branch to avoid CI credits. On a Windows machine with Node.js 22+ and npm, run the following from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Verify-TT2-Offline.ps1
```

Optionally include the full 18-build benchmark (it may be CPU-intensive):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Verify-TT2-Offline.ps1 -Benchmark -SkillPoints 22600
```

The script invokes **local** `npm test`, `npm run check:data`, and `npm run check:modules` (complete ESM import graph, release versions and syntax checks); the benchmark runs only with `-Benchmark`. For the module graph alone, run `npm run check:modules`. It never submits GitHub Actions jobs, merges a PR or deploys a website. It does not replace gameplay calibration, especially for live contracts and season reset. See [module-graph release gate](docs/ESM_MODULE_GRAPH.md).


## Browser qualification (optional, local or deployed)

Install Node.js 22+, Python and Google Chrome (the default browser). From the repository root:

```powershell
npm install
npm run test:e2e
npm run test:e2e:report
````

No Playwright browser download is needed when Chrome is installed. To use Playwright-managed Chromium instead, run `npx playwright install chromium`, set `$env:TT2_E2E_BROWSER = "chromium"` before running the suite, and remove that environment variable afterwards with `Remove-Item Env:TT2_E2E_BROWSER`.

The local suite starts its own Python HTTP server on 127.0.0.1:8765 and closes it afterwards. Stop any previous server on that port. The VS Code Playwright extension discovers the configuration; select the Chromium project in the Testing panel. `npm run test:e2e:ui` opens interactive Playwright UI. The regular `npm run check` remains dependency-free and does not launch a browser. Reports and traces are local, ignored by Git; only synthetic player exports are used.

To qualify the actual deployed website, explicitly set the target URL (the suite will not start a local server):

```powershell
$env:TT2_E2E_BASE_URL = 'https://tap-titans.leskasoft.com'
npm run test:e2e
Remove-Item Env:TT2_E2E_BASE_URL
```

The browser suite checks JSON import (paste, clipboard, file), actual worker allocation, budget and export, share-link privacy, malicious input, storage cleanup, keyboard/help, all four locales and 360px layouts, eight pages and internal HTTP links, sitemap and robots. It does not certify external link availability, search indexing, Core Web Vitals, response-header security or real game optimality. No GitHub Actions are used.
