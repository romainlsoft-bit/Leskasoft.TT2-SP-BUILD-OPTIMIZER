# TT2 search vocabulary and content research (17 November 2026)

## Target terms used by players

English primary: `Tap Titans 2 skill tree optimizer`, `TT2 SP optimizer`, `skill points optimizer`, `skill tree builder`, `TT2 build optimizer`, `skill tree calculator`, `player data export`, `import skill tree`, `copy build`.

Secondary: `artifact optimizer`, `equipment sets`, `pet optimizer`, `exotic pets`, `transcendent pets`, `gemstones`, `mystic gemstone research`, `Necrobear`, `Titan Souls`, `monument optimizer`, `Transcendence`, `Clan Ship`, `Pet/Fairy`, `Heavenly Strike`, `Shadow Clone`, `Dagger`, `Gold Gun`, `Chesterson`, `QoL`, `push build`, `farming build`.

French: `optimiseur TT2`, `calculateur SP Tap Titans 2`, `optimiseur arbre de compétences`, `build TT2`, `import de compte TT2`, `familiers exotiques`, `monuments Transcendance`. Keep original English names for in-game search and player terminology, rather than artificially translating the mechanics.

Ukrainian and Russian: localized variants of `оптимізатор/оптимизатор дерева навичок/навыков`, `білд/билд TT2`, `очки навичок/навыков SP`, `імпорт/импорт даних`, preserving the official English names of skills, damage sources, gems, Necrobear, monuments.

## Evidence and intent

- [rawrzcookie’s 2023 Reddit announcement](https://www.reddit.com/r/TapTitans2/comments/18selad/) names `web sp optimizer`, `skill tree builder`, `Player Data Export`, `Skill Tree Export`, six damage types, three gold types, share and clipboard export.
- [July 2026 all-in-one request](https://www.reddit.com/r/TapTitans2/comments/1v9zmpa/) explicitly asks for one optimizer considering `skill points`, `necrobear`, `gemstones` and the player's own playstyle. This is evidence of user intent, not proof of search volume.
- [Community import instructions, July 2026](https://www.reddit.com/r/TapTitans2/comments/1uuoe4h/) mention game `settings > services > export`, choose damage/gold type, optimize, copy text and import to TT2 skill tree.
- [Official Game Hive 8.4.0 patch](https://www.gamehive.com/blog/devlog-239-version-840-patch-notes/) (5 Nov 2026) names Clan Technology and Titan Souls bonuses; avoid claiming these mechanics are all numerically implemented.
- [Official Season 13 DevLog](https://gamehive.com/blog/devlog-231-transcendence-season-13/) (11 Aug 2026) names monuments and Transcendent Pets.
- [TT2 Compendium](https://www.tt2-compendium.com/en/toolscorner) classifies Artifact, Pet, Set Power optimizers. Do not copy copyrighted guide material.

## Architecture and truthfulness

Separate static guides (English / French / Ukrainian / Russian) because the calculator's interactive workflow must remain short. Self-contained indexable HTML, one H1, descriptive H2s, localized metadata, canonical + reciprocal hreflang, matching visible FAQ text and JSON-LD, internal link from each calculator header and sitemap links.

Distinguish **imported/recognized** from **numerically modeled** and **validated in game**. Do not claim all bonuses are simulated until release gates pass. Exported TT2 JSON permits importing the skill tree without retyping skill levels; it does **not** automatically equip pets or gear or edit account bonuses. No manual multiplier entry is needed when a supported export supplies it; missing sections remain unknown.

No invented traffic counts, rankings, guaranteed stage gains or guaranteed Google indexing. Submit sitemap and verify rendered URLs through Search Console only after final release and deployment.
