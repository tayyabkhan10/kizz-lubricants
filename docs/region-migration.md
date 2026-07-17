# Region migration → Singapore (make it instant)

## Why
The Vercel function was running in **iad1 (Washington, USA)** while users are in Pakistan.
Measured `/api/health` (a bare `SELECT 1`) at **~410ms every call, even warm** — that's pure
cross-continent network distance, not query time. Every dynamic action (sign-out, login, page
data) round-trips to the US; chained actions hit 1s+.

Fix: move **both** the serverless function and the Neon database to **Singapore** so they sit
next to each other, ~130ms from Pakistan instead of ~400ms to the US.

## ⚠️ Order matters — database FIRST, function SECOND
If the function moves to Singapore while the DB is still in the US, data pages get **worse**
(server and DB end up on opposite sides of the planet). Do the steps in this exact order.

## Steps

### 1. Create the new database in Singapore
1. In the Neon console, create a **new project** in region **AWS `ap-southeast-1` (Singapore)**.
   (Neon can't relocate an existing project, so a new one is required.)
2. Copy real data across — do **not** reseed (that would lose live business data):
   ```bash
   # from the OLD (US) database
   pg_dump "<OLD_DATABASE_URL>" --no-owner --no-privileges -Fc -f kizz.dump
   # into the NEW (Singapore) database
   pg_restore --no-owner --no-privileges -d "<NEW_SINGAPORE_DATABASE_URL>" kizz.dump
   ```
   (If `pg_dump` isn't handy, `npm run db:push` then a plain-SQL data copy also works — but the
   dump/restore above is the safe path that preserves everything.)
3. Verify row counts match between old and new before continuing.

### 2. Point the app at the new database
- In **Vercel → Project → Settings → Environment Variables**, update `DATABASE_URL` to the new
  Singapore connection string (use the **pooled** connection string).

### 3. Move the function to Singapore
- This repo's `vercel.json` already pins `"regions": ["sin1"]`. As a belt-and-suspenders step you
  can also set **Settings → Functions → Region → Singapore (sin1)** in the dashboard.

### 4. Deploy and verify
```bash
git push            # deploys vercel.json (sin1) + new DATABASE_URL
```
Then confirm the move landed:
```bash
curl -s -D - https://kizz-beta.vercel.app/api/health | grep -i x-vercel-id
```
- **Before:** `x-vercel-id: bom1::iad1::…`  (function in US)
- **After:**  `x-vercel-id: …::sin1::…`     (function in Singapore)

Re-time it — `/api/health` should drop from ~410ms toward ~150ms, and sign-out from ~1s toward
~250ms.

## Note
Region selection in `vercel.json` uses a **single** region, which is what the Hobby plan allows.
If you later upgrade and want multi-region, that's a separate change.
