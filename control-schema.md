# kiosk-control.json — schema (single source of truth)
{
  "soldOut": ["drink-id", ...],   // drink IDs to grey out on the kiosk (see drinks.json)
  "special": null,                 // or { "title": "...", "detail": "...", "drinkId": "..." }
  "updated": "ISO-8601 string"     // last write time
}
The kiosk reads this every ~90s. The Owner Control app writes it. drinks.json lists valid IDs.
