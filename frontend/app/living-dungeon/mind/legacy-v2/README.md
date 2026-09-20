Frozen save-replay implementation from rules `mind-beneath-1` (Norwegian, save v2).

Do not translate or refactor these files. Their authored strings participate in the original state digest. `storage.ts` validates every historical command against these exact rules before replaying the same choices in the English rules and rebinding plans. These modules never drive the rendered game, AI context, or new saves. No stale-plan validation is skipped. Custom maneuver names remain the player's text.

The current format is save v3 / `mind-beneath-2`. The storage key stays unchanged so existing browser memories can be found. Migration is read-only until a successful action persists the upgraded journal. Invalid and older incompatible saves are left untouched.
