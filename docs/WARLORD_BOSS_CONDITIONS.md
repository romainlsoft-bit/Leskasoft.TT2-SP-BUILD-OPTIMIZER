# Warlord ideal boss conditions — issue #9

Anchoring Shot (ClanShipStun) increases damage against a stunned titan across all damage sources. The public push scenario now assumes a Clan Ship is available and the hit takes place during its stun window, when max stage is at least 700 (the talent unlock) and the talent is bought. An explicit clanShipAvailable=false disables it. Membership is not verified by the export; the assumed ship availability is an implementation decision, consistent with the existing ideal Coordinated Offensive scenario. No new UI toggle. This is not a permanent damage bonus.

Searing Light (HelperInspiredWeaken) improves inspired hero damage while War Cry is active. Enable the already implemented A multiplier only when the verified selected spell loadout includes HelperBoost (War Cry) and the existing maximum-spell hypothesis holds. Keep the existing route reductions, which are community proxies rather than native calibrated formulas; do not multiply by inspired hero count. The lower-level explicit diagnostic flags are unchanged. Display the effective conditions after optimization in all four languages. Never equate stun duration, stage skip or inspired count with direct damage.

Sources: https://tt2.wiki/en/skill-tree (current Searing Light, Anchoring Shot and Aerial Assault descriptions), https://www.tt2-compendium.com/en/wiki/skills/anchoringshot, pinned Unity 8.4 talent columns. The wiki explicitly notes a Clan Ship requires joining a clan. This assumption must be tested in game for the actual account. Neither simultaneous activation nor uptime is proven.

Qualification: npm run check; npm run bench:22k; npm run bench:issue30; npm run test:e2e. No GitHub Actions.
