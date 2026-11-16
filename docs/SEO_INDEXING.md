# Search indexing and technical SEO — TT2 Skill Optimizer

## What is implemented

- Four **crawlable static HTML** pages, no JavaScript required to read essential content:
  - English: https://tap-titans.leskasoft.com/
  - French: https://tap-titans.leskasoft.com/fr/
  - Ukrainian: https://tap-titans.leskasoft.com/uk/
  - Russian: https://tap-titans.leskasoft.com/ru/
- Each page has its own `<html lang>`, canonical URL, factual H1, descriptive title/meta description, localized visible text, reciprocal `hreflang` tags, and `WebApplication` JSON-LD.
- No fabricated star ratings or user reviews in JSON-LD.
- All four canonical URLs appear in `sitemap.xml`. `robots.txt` references the sitemap.
- No commercial slogans or invented gameplay promises: factual methodology and a link to the mathematical audit are available directly in HTML.
- Language picker uses real URLs instead of relying on query-string-driven client rendering; the previous `?lang=...` URLs redirect in the browser to the corresponding static pages.
- Independent MIT attribution to rawrzcookie and an accessible source-code link are retained.

## Google Search Console — actions requiring domain ownership

1. Confirm GitHub Pages is configured for `tap-titans.leskasoft.com`, HTTPS is enforced, and all **four** paths return HTTP 200 to browsers. Check that `src/app.js`, `src/i18n.js`, and CSS load on each localized path.
2. At https://search.google.com/search-console/ add the **Domain property** `leskasoft.com` if you control its DNS (Google will supply a TXT verification record). If the entire domain is already verified, use its existing property. A URL-prefix property for `https://tap-titans.leskasoft.com/` is an alternative.
3. Submit **`https://tap-titans.leskasoft.com/sitemap.xml`** once in Search Console → Sitemaps. Do not repeatedly submit unchanged sitemaps.
4. In URL Inspection, check the English root and FR/UK/RU paths: access, indexed status, selected canonical, rendered HTML and localizations. Request indexing if not already indexed, without assuming it will be immediate or guaranteed.
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
