# Locale loading — audit #56

The English strings remain the canonical message identifiers. The four localized HTML routes and SEO metadata remain static. The page awaits the catalog for its own language before initializing dynamic UI; the legacy ?lang= parameter still navigates to the corresponding static page. No browser path loads all dictionaries. English uses no dictionary.

The former monolithic dictionary was parsed in full, including later Object.assign and individual assignments, keeping last-write precedence. Effective dictionary counts: fr 451, uk 452, ru 451. All effective keys and values are preserved. No new translations or gameplay changes in this lot. Existing gaps between catalogs are retained, with the original English fallback. The three catalogs are immutable, and concurrent requests for one language reuse the same promise. If a catalog fails to load, the calculator remains usable with English fallback for dynamic strings, with the error recorded in the console.

Tests explicitly load all catalogs via a test-only fixture. E2E checks the actual requested modules for every locale. The module graph gate recognizes dynamic literal imports and validates their file existence, release tokens and cache identity. Four entry points are refreshed together.

Qualification: npm run check and npm run test:e2e; then run the same browser suite against the deployed URL after publication. No GitHub Actions. Network size estimates refer to uncompressed module source, not measured page-load time.
