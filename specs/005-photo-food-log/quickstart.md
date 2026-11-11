# Quickstart: Photo Food Log

Prerequisites: features 003 and 004 deployed; `pnpm install`; an AI key (`pnpm admin ai-key issue <user> --stage dev`).

## 1. Automated checks
```sh
pnpm check && pnpm synth
```

## 2. Deploy
```sh
pnpm deploy:dev
```

## 3. Add a photo (web)
Open `/food` → **Add photo** → pick a meal photo, caption "dal, 2 rotis", Lunch → Save.
Expected: a pending card under Lunch with the photo and "Pending analysis"; eaten/net/macros unchanged; the ledger says "1 meal pending analysis".

## 4. Run the agent loop (curl)
```sh
H=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_pending_food_photos","arguments":{}}}'
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_food_photo","arguments":{"date":"<date>","entryId":"<entryId>"}}}' | head -c 400
curl -s "${H[@]}" $MCP_URL -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"submit_food_estimate","arguments":{"date":"<date>","entryId":"<entryId>","calories":520,"protein":18,"carbs":82,"fat":12}}}'
```
Expected: list shows the entry; get returns an `image` item; submit confirms. Reload `/food`: the entry shows 520 kcal with "AI-estimated" and the ledger includes it. Submitting again → error "already analysed".

## 5. With a real agent
In Claude Code, Cursor or Claude Desktop (see feature 004 quickstart), ask: "List my pending food photos, look at each photo and caption, estimate calories and macros, and submit them."

## 6. Edge checks
- Edit a pending entry's caption/meal; fill values by hand (becomes "entered by you"); correct an AI value (becomes "edited"); delete one and confirm its photo URL stops working.
- Upload a PNG or a 5 MB file: refused with a clear message.
- Another member (or a signed-out request) cannot fetch the photo URL after it expires or ever list your pending entries.
