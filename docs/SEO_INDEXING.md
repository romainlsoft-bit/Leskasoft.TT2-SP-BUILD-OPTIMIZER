# Search indexing and technical SEO — TT2 Skill Optimizer

## What is implemented

- Eight **crawlable static HTML** pages (four calculators and four companion guides), no JavaScript required to read essential content:
  - English: https://tap-titans.leskasoft.com/
  - French: https://tap-titans.leskasoft.com/fr/
  - Ukrainian: https://tap-titans.leskasoft.com/uk/
  - Russian: https://tap-titans.leskasoft.com/ru/
- Each page has its own `<html lang>`, canonical URL, factual H1, descriptive title/meta description, localized visible text, reciprocal `hreflang` tags, and `WebApplication` JSON-LD.
- No fabricated star ratings or user reviews in JSON-LD.
- All eight canonical URLs appear in `sitemap.xml`. `robots.txt` references the sitemap.
- No commercial slogans or invented gameplay promises: factual methodology and a link to the mathematical audit are available directly in HTML.
- Language picker uses real URLs instead of relying on query-string-driven client rendering; the previous `?lang=...` URLs redirect in the browser to the corresponding static pages.
- Independent MIT attribution to rawrzcookie and an accessible source-code link are retained.

## Google Search Console — actions requiring domain ownership

1. Confirm GitHub Pages is configured for `tap-titans.leskasoft.com`, HTTPS is enforced, and all **eight** paths return HTTP 200 to browsers. Check that `src/app.js`, the selected locale catalog, and CSS load on each calculator path.
2. At https://search.google.com/search-console/ add the **Domain property** `leskasoft.com` if you control its DNS (Google will supply a TXT verification record). If the entire domain is already verified, use its existing property. A URL-prefix property for `https://tap-titans.leskasoft.com/` is an alternative.
3. Submit **`https://tap-titans.leskasoft.com/sitemap.xml`** once in Search Console → Sitemaps. Do not repeatedly submit unchanged sitemaps.
4. In URL Inspection, check the English root, FR/UK/RU paths and four guide URLs: access, indexed status, selected canonical, rendered HTML and localizations. Request indexing if not already indexed, without assuming it will be immediate or guaranteed.
5. Verify deployed `robots.txt`, redirects, canonical/hreflang links and structured data. Run https://search.google.com/test/rich-results and https://pagespeed.web.dev/ (mobile and desktop).
6. Link to the TT2 tool from an **existing relevant page on leskasoft.com** using a normal HTML link. This helps discovery; avoid link farms or keyword stuffing.
7. After indexing, monitor query/page impressions, clicks and Core Web Vitals in Search Console. Adjust factual wording to actual searcher intent, not to keyword-density targets.
8. Recheck schema and data version references whenever TT2 patches release. Don't imply complete mathematical compatibility unless independently validated.

Google **does not guarantee indexing or ranking**, and sitemap submission is a discovery hint, not a ranking boost. An absent Search Console property means indexing state cannot be verified programmatically.

## Usability and 22k+ Skill Point qualification

- The 72-skill solver uses a bounded approximation across branches beyond 12,000 SP and remains exact per branch for its **modeled** additive score, not actual game mechanics.
- A 22,500-SP synthetic-data benchmark executed in a JavaScript environment took **approximately 10.5 seconds for Clan Ship/Fairy/QoL** and **17.3 seconds for Shadow Clone/Fairy/no QoL** on 16 November 2026. This is not an Android/browser performance guarantee.
- Run `npm run bench:22k` (Node 22+) to reproduce the benchmark on a developer machine; record wall-clock time and heap usage, then test a real account on Android. Benchmark scripts only use synthetic settings: **do not commit real player exports**.
- The player data parser is based on source export fields (`playerStats`, `skillTree`, `equipmentSets`) and the skill-build format (`Version`, `Skills`). Verify with game version 8.4 exports before claiming full compatibility.
- A release should never hide a solver error by presenting the generated allocation as exact, nor claim mobile run times without actual device tests.

## Primary documentation

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/software-app
- https://developers.google.com/search/help/crawling-index-faq
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https

## Final audit #56 — qualification and limits

The eight pages enforce a common CSP meta policy (same-origin executable scripts, styles, workers and connections; no inline executable script, eval, object, frames or form submission) and a no-referrer policy. The browser test attempts a harmless inline script and verifies that the genuine module worker and CSSOM progress bars still operate. A meta CSP is not an HTTP response header and cannot enforce frame-ancestors. GitHub Pages controls response headers; do not pretend that a _headers file or an HTML meta HSTS directive configures them. Configure HTTPS in Pages; if custom security headers are required, use an explicitly approved hosting/proxy configuration.

Run locally on the final stacked branch:

```powershell
npm install
npm run check
npm run test:e2e
```

Chrome is the default installed browser, without a separate Playwright download. The mobile browser test attaches observed laboratory timings and decoded module bytes to the HTML report; this is not field LCP/CLS/INP certification. After publication on the custom domain:

```powershell
$env:TT2_E2E_BASE_URL = "https://tap-titans.leskasoft.com"
npm run test:e2e
npm run audit:site -- --external
Remove-Item Env:TT2_E2E_BASE_URL
```

The HTTP audit checks canonical HTTPS responses, HTML MIME, policy tags, sitemap and robots, and HTTP-to-HTTPS redirection. Missing hosting response headers and external links returning redirects, bot blocks or failures are explicitly reported for review; they are not silently treated as success. It requires no credentials. Check the browser report and JSON output separately.

Game Hive patch notes 8.4.0 and the historical Season 13 post were accessible during the source review. The Reddit links and Leskasoft homepage could not be verified using the available web service; run the external audit from the developer machine. The public TT2 domain and npm registry were also inaccessible from the review environment, so no deployed or lockfile success is asserted. Generate and commit the npm lockfile on a machine that can resolve the registry (`npm install --package-lock-only --ignore-scripts`), then prefer `npm ci`. Google indexing, field Core Web Vitals and actual response-header configuration remain external operational checks. No GitHub Actions.

All eight pages reference a shared 1200 × 630 PNG social preview with localized alternative text. The illustration is a generic skill tree, not an actual in-game tree or evidence of stronger builds. The HTTP audit checks that the PNG is reachable with its image MIME type.
