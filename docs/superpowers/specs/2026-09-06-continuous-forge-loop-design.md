# Continuous Forge Loop Design

## Goal

Make forging behave like a repeatable draw: the player can forge, inspect the result, optionally equip it, and immediately forge again without navigating back or moving to a different primary action.

## Interaction

- The forge modal remains a single stable surface.
- The centered primary button stays in the same position across all states.
- Its labels are `锻造`, `锻造中...`, and `再锻造一次`.
- Material cost is shown above the button as the configured material icon plus `current/cost`, for example `28/1`.
- A successful result never requires a return action before another forge.
- When the result is equipable, `立即装备` appears inside the result detail as a secondary action.
- After equipping, that secondary action becomes a disabled `已装备` state while `再锻造一次` remains available.
- When the result is not equipable, show the realm requirement instead of an equip button.
- The top-right close control remains the only exit and is locked only while the forge operation is running.

## Data Safety

- `Game.forge()` remains the only source of material consumption, reward selection, and inventory persistence.
- `OperationGuard` continues to prevent repeated clicks while forging.
- The material counter refreshes from `Game.inventory` after every result.
- When the remaining material count is below the configured cost, the primary action becomes disabled.

## Visual Hierarchy

- The draw result owns the center of the modal.
- The equip action is visually subordinate and placed near the result it affects.
- Material availability sits immediately above the primary action.
- Probability details remain collapsed by default.

