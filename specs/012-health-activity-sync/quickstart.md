# Quickstart: validate Health Activity Sync (012)

## Automated

```sh
pnpm check   # typecheck + lint + tests (activity domain, sync auth, overwrite, privacy, board)
pnpm synth   # five new routes synthesize
```

## Manual (dev stage, after `pnpm deploy:dev`)

1. Sign in, open **Settings → Apple Health sync**, set the step goal to 8,000 and click **Generate token**. Copy it.
2. Sync one day with curl:
   ```sh
   curl -sS -X POST "$API_URL/integrations/activity" -H "Authorization: Bearer $SFH" \
     -H 'content-type: application/json' -d '{"days":[{"date":"'$(date +%F)'","steps":"8,423.0","active_kcal":512,"distance_km":6.1}]}'
   ```
   Expect `200` with `steps: 8423, goalHit: true`. Settings shows "Last synced … · Shortcut".
3. Send the same date with `4100` steps. Expect the stored value to be 4100 (replaced, not added).
4. Send `steps: 200000`. Expect `422` with `"<d> <Mon>: steps must be between 0 and 100,000"`.
5. Send the same token to `$API_URL/mcp`. Expect `401`.
6. Regenerate the token. The old token now gets `401`.
7. As another member, open `/squad?board=steps`, `/squad?view=today` and the first member's profile, and check that steps, the rest-day card and the 30-day chart appear. Turn off **Share my steps** and check they disappear.
8. Through an AI client with the member's `sfk_` key, call `upsert_daily_activity` for yesterday, then `get_daily_activity`.
