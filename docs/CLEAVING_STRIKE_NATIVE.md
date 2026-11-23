# Cleaving Strike: native critical-event score — TT2 8.4

`vendor/skills.js` (`SkillTreeInfo2.0.csv`) identifies:

- `HeavyStrikes.A[n]` as **CritDamage** (the bonus on a critical hit).
- `HeavyStrikes.B[n]` as **CritChance** (a talent chance contribution).

The old optimization score credited `log10(A[n])` as if **every attack
were critical** on all six damage sources. In contrast, the existing
equipment and conditional-proc models only accept **Heavenly Strike**
as a guaranteed critical-hit source (Angelic Radiance).

## Scoring correction

For Heavenly Strike, the guaranteed critical hypothesis is unchanged:
`sourceLog10 = log10(A[n])`.

For Clan Ship, Pet, Shadow Clone, Dagger and Gold Gun, the proxy no
longer treats Crit Damage as unconditional. It uses a **limited,
source-only eligible-event hypothesis**:

```text
p = B[n]
model sourceLog10 = log10((1 - p) + p × A[n])
```

It is calculated with `binaryExpectedMultiplierLog10` and
`positiveLog10` for stable scientific-value arithmetic.

### Exact limits

- `B[n]` is **not** the player's true total critical chance.
  The model deliberately assumes zero *other* critical chance for this
  illustrative isolated talent scenario.
- Current account-exported final chance is **not** carried into the
  hypothetical newly allocated tree.
- Critical damage from pets, artifacts and equipment, crit eligibility
  and event-specific game mechanics are **not** assumed to multiply each
  other under a verified cross-source formula.
- These source-only values must **not** be presented as real average
  DPS, guaranteed stage gains, or actual measured crit probabilities.
- Protect existing imported `HeavyStrikes` levels for non-HS builds
  under `protectUnmodeledSkills`. Do not protect the skill by this
  mechanism for Heavenly Strike, whose critical-hit condition is sourced.
- No added attack selector, hit-damage input, manual crit chance,
  fictitious multiplier or arbitrary SP cap.

The calculated source evidence and limitations are returned as
`criticalSourceOnly`, with an explanation in EN/FR/UK/RU.

Validation on a developer workstation or existing authorized TeamCity:

```bash
node --test tests/cleaving-strike-native.test.js
npm run check
npm run bench:issue30
npm run bench:push
```

No GitHub Actions. Gameplay verification in the game's Stats panel
remains required before claiming a stronger build.
