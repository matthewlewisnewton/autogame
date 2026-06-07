# 09 — Update Telepipe Evacuation design doc for checkpoint/resume policy

`game/docs/design.md` still documents the pre-289 policy: telepipe clears all transient state, has no checkpoint/resume path, redeploy always starts a fresh dungeon, and card charge persistence is out of scope. Rewrite the Telepipe Evacuation section to match the implemented ticket 289 behavior without contradicting ticket 287 durability rules.

## Acceptance Criteria

- **Telepipe suspend/resume**: When the last active player extracts, the run is suspended to the hub with a checkpoint (layout, enemies, objective progress, card charge state). Redeploying from hub resumes the **same** run id and restores card charges.
- **New sortie**: Abandoning the suspended checkpoint (Abort Sortie) or starting a fresh quest without a checkpoint clears the suspend state and starts a **new** run with fresh card draws/charges.
- **Durability matrix** (explicit bullets):
  - HP: persists across telepipe-resume **and** new sortie; restored only at medic booth (287).
  - Magic stones: persist across telepipe-resume **and** new sortie (287).
  - Card charges: **persist** on telepipe-resume; **reset** on new sortie.
- Remove or replace sentences claiming "no run checkpoint or resume path", "redeploy always starts a fresh dungeon", and "card charge persistence is unchanged / out of scope".
- Wording stays consistent with `game/docs/gameplay-review.md` suspend/abandon terminology where applicable.
- No changes to unrelated design sections (Combat Mechanics, Stage Bosses, etc.).

## Technical Specs

- **`game/docs/design.md`**: Rewrite the **Telepipe Evacuation** section (currently lines ~28–35) with the policy above. Keep bullet structure. Mention that abandoning via hub UI emits `abandonRun` if helpful for implementers reading the doc.

## Verification: code
