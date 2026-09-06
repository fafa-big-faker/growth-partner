# Random Weapon Affixes Design

## Goal

Make every forged axe an independent weapon instance whose configured skills receive permanent, weighted random values at forge time.

## Configuration Model

- The item table defines an axe's static identity, quality, sell price, and one or more skill IDs.
- The skill table maps each `skill_id` to one `buff_id` group.
- The BUFF table contains five weighted rows per `buff_id`. Each row has an independent row ID, BUFF quality, description template, three optional value ranges, and weight.
- BUFF row weights are normalized within the matching `buff_id` group. Current weights `800/100/50/30/20` therefore represent `80%/10%/5%/3%/2%`.
- Percentage ranges produce a value rounded to two decimal places. Quality IDs, multipliers, and refund counts produce integers. A single number is a fixed value; `min,max` is inclusive.

## Forge Flow

1. Select an axe from the configured forge pool.
2. Resolve every skill ID on that axe to its BUFF group.
3. Independently select one weighted BUFF row for every skill.
4. Generate and freeze that row's `value1/value2/value3` values.
5. Atomically consume forge materials and create one weapon instance containing the rolled skills.
6. Return that exact instance to the forge result UI.

Refreshing, equipping, selling, or chopping never rerolls an existing weapon.

## Persistence

- Stackable items remain in `inventory` as `item_id + quantity`.
- Axes live in a separate `weapon_instances` table with a unique instance ID, item ID, user role, and JSON skill rolls.
- `player_state` records both the equipped item ID for compatibility and the equipped weapon instance ID for identity.
- Equip and sell operations use instance IDs and execute through atomic database functions.
- Existing aggregate axe quantities are migrated into separate legacy instances without deleting quantity. Their skills are deterministically initialized by the client once and then frozen.

## Runtime Effects

- Reward multiplier skills compare the chopped reward quality with the rolled target quality, then use the frozen probability and multiplier.
- Refund skills use the frozen probability and refund amount.
- Multiple skills on one axe roll and trigger independently.
- Runtime trigger checks may remain random on every chop; only skill strength is fixed at forge time.

## Presentation

- The axe's own quality continues to control its name and frame treatment.
- Every rolled skill also has a BUFF quality.
- Only substituted values in the description are colored with the BUFF quality color; surrounding copy stays neutral.
- Forge results and weapon details render the exact instance values, not static item-level copy.
- The weapon inventory renders every axe instance separately, including duplicate item IDs.

## Error Handling

- Invalid or empty BUFF groups prevent that forge result from being persisted and show a configuration error.
- Ranges are normalized even if entered in reverse order; malformed numeric values fail validation during configuration sync.
- Repeated forge, equip, and sell clicks remain guarded in the UI, while database RPCs enforce resource and ownership checks.

## Verification

- Configuration tests cover English headers, all BUFF fields, group weight totals, range parsing, and the corrected `{value1}` placeholder.
- Unit tests cover weighted selection, fixed and ranged values, two-decimal percentages, integer multipliers/counts, and independent multi-skill rolls.
- Integration source tests cover instance-based forge, equip, sell, inventory display, and runtime BUFF usage.
- The migration is idempotent and preserves existing axes as separate instances.
