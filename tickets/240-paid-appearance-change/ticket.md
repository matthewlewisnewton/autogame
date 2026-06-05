# 240-paid-appearance-change

## Difficulty: medium

## Goal

Applying an APPEARANCE edit (proportions/body/colors/model) at the character booth costs gold — server-side atomic charge (reuse the 215 currency-then-commit ordering) + price config + client confirm. Hat swaps stay free (241).

## Acceptance Criteria

- 1. Appearance changes deduct gold atomically (charge persists before applying; no free-edit exploit). 2. Price in config. 3. Client confirm dialog. 4. Test incl. insufficient-funds + crash-safety.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
