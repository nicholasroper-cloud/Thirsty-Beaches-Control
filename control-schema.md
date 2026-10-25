# kiosk-control.json — schema (single source of truth)

The kiosk server fetches this file every ~90 s (pull-only; the kiosk never writes it).
The Owner Control app (`owner/`) writes it through the GitHub API; you can also edit it by hand
on github.com. This repo is **public**: never put a secret in this file.

```jsonc
{
  "soldOut": ["drink-id", ...],        // drink ids to grey out on the kiosk (see drinks.json)
  "soldOutOptions": ["addon-id", ...], // add-on ids to grey out (see addons.json)
  "special": null,                     // LEGACY, ignored by the kiosk. The owner app clears it on save.
  "specials": [ ... ],                 // featured specials the kiosk shows (see below)
  "healthcheckUrl": "https://hc-ping.com/…", // optional: overrides HEALTHCHECK_URL on the kiosk
  "updated": "ISO-8601 string",        // last write time (set by the owner app)

  "settings": { ... },                 // NEW (kiosk v24+): remote overrides, see below
  "commands": { ... }                  // NEW (kiosk v24+): one-shot actions, see below
}
```

Kiosks older than v24 ignore `settings` and `commands`.

## specials — what the kiosk features

The kiosk shows every entry in `specials[]` as a "Today's Specials" card (and ignores the legacy
`special` field entirely). The owner app keeps one at a time: both the Daily Special tab and the
Drink Lab replace the list. Entry shape:

```jsonc
{
  "id": "sp-menu-swole-patrol-1761424289348", // unique; the kiosk re-renders when id/updated change
  "name": "Thicc & Thirsty",          // ≤28 chars, shown as the card title
  "label": "Staff Pick",              // small tag above the name (default "Today's Special")
  "blurb": "Today's featured drink",
  "catKey": "floats",                 // kiosk MENU category; unknown key = card skipped
  "baseItemId": "swole-patrol",       // menu item the price is computed from; sold out = card greyed
  "base": null, "mods": [],           // "group:Choice" ids (Drink Lab recipes)
  "drinkId": "swole-patrol",          // set for a regular menu drink (Daily Special tab)
  "price": 7.5,                       // informational; the kiosk re-prices from its own menu
  "createdBy": "owner" | "ai",
  "updated": "ISO-8601"
}
```

Known kiosk limitation: tapping a special opens the generic customizer (`openAIDrink`) priced from
the category's build-your-own item, even for a menu drink. A kiosk fix is to open the real item
when `drinkId` is set (`openItem(sp.catKey, sp.drinkId)`).

## settings — remote overrides of kiosk-config.env

Only these keys are accepted. Anything else (including every secret: Clover token, API keys,
URLs) is ignored and reported as an error on the status page. Each value is validated on its
own: a bad value is rejected and the rest still apply. A key that is **absent** (or `null`)
means "use the value in kiosk-config.env on the PC" — so deleting a key undoes the override.

| key                   | type / range                       | applied            |
|-----------------------|------------------------------------|--------------------|
| `PAY_ENABLED`         | `true` / `false`                   | idle restart       |
| `FLEX_IP`             | IPv4 like `"192.168.1.50"`, or `""`| idle restart       |
| `FLEX_PORT`           | integer 1–65535                    | idle restart       |
| `PAY_TIMEOUT_MS`      | integer 15000–300000               | idle restart       |
| `UPDATE_INTERVAL_MIN` | integer 5–1440                     | live               |
| `HIDE_CATEGORIES`     | array of strings (or `"A, B"`), ≤50 × ≤60 chars | live  |
| `AI_DESIGN_ENABLED`   | `true` / `false`                   | live + screen reload when idle |
| `VIBE_MODEL`          | `"claude-…"` model id              | live               |
| `DRINK_MODEL`         | `"claude-…"` model id              | live               |

"Idle restart" = the kiosk server restarts itself (a couple of seconds) once nothing is in
flight and nobody has ordered for 2 minutes; the screen then reloads itself on the attract
screen so it sees the new tap-to-pay state. The kiosk keeps the last good settings on disk,
so they survive a reboot without internet.

Safety net: if the kiosk server crashes 3 times within 10 minutes while remote settings are in
force, the kiosk enters **safe mode** — it ignores exactly those settings and runs on
kiosk-config.env alone until the settings are changed here.

Example:

```json
"settings": { "AI_DESIGN_ENABLED": true, "HIDE_CATEGORIES": ["Staff Only"], "UPDATE_INTERVAL_MIN": 30 }
```

## commands — one-shot actions

```json
"commands": {
  "restartAt":      "2026-10-25T21:30:00Z",
  "reloadScreenAt": "2026-10-25T21:30:00Z",
  "checkUpdateAt":  "2026-10-25T21:30:00Z"
}
```

| command          | what happens                                                                 |
|------------------|------------------------------------------------------------------------------|
| `restartAt`      | restart the kiosk server (waits until idle: never during an order or a tap)  |
| `reloadScreenAt` | the kiosk screen reloads the next time it is on the attract screen (≤3 min)  |
| `checkUpdateAt`  | check `update-manifest.json` now instead of waiting for the hourly check      |

Each value is an ISO-8601 time. A command runs **once**, when that time has come (by the kiosk
PC's clock) and it is newer than the last one of the same name the kiosk ran (remembered on the
PC). To run it again, write a newer time — "now" is the normal choice (the owner app's buttons
do exactly that). A time in the future schedules it (max 7 days ahead; further is rejected).
Commands that were already more than an hour old when a kiosk first saw them are not replayed.

## Where to see the result

`https://thirstybeaches.com/trailer` shows "Kiosk: online · v24 · seen 1 min ago"; with the
staff secret saved there it also shows the last update, rollbacks, errors (including rejected
settings/commands), tap-to-pay and Clover status. Raw: `GET
https://tb-where.nicholasroper.workers.dev/kiosk/status` (`?full=1` with the staff secret).
