# 312-excalibur-photon-windup-balance

## Difficulty: medium

## Goal

Balance Excalibur Photon (excalibur_photon) — flagged for DPM dominance (200ms cooldown + swingsPerUse 2 => ~4.5x peer sustained DPS). Rather than nerf per-hit damage, add a conservative WIND-UP / recovery lock using the 307 card-windup mechanic (windUpMs) so its effective uptime/spam drops and sustained DPS comes back into band. Keep its big per-hit feel. Tune the windUpMs conservatively (enough to bring DPM toward peer Q3, not so much it feels unusable). ACCEPTANCE: excalibur_photon has a windUpMs lockout; its sustained DPS/DPM moves toward the weapon band; per-hit damage unchanged; test. SCOPE: game/shared/card*.json (windUpMs) + game/server (if needed) + test. (307 wind-up mechanic already merged.)

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
