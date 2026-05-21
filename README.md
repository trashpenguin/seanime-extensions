# Seanime Manga Extensions

Custom manga provider extensions for [Seanime](https://seanime.rahim.app/) — a self-hosted anime and manga manager.

> Extensions are JavaScript plugins that let Seanime fetch manga chapters and pages from external sources.
> All providers run server-side inside Seanime's JS runtime.

---

## Providers

| Provider    | Source          | Type         | Version | Status     |
|-------------|-----------------|--------------|---------|------------|
| MangaDex    | mangadex.org    | Official API | 1.0.0   | ✅ Working |
| ComicK      | comick.io       | Official API | 2.0.0   | ✅ Working |
| WeebCentral | weebcentral.com | Scraper      | 1.1.0   | ✅ Working |
| MangaPill   | mangapill.com   | Scraper      | 4.0.0   | ✅ Working |

### Provider Details

**MangaDex** — Best overall reliability. Uses the official MangaDex API. Supports
multiple languages and scanlation groups. Covers virtually all popular manga titles.

**ComicK** — Uses the official ComicK API. Excellent coverage of manga, manhwa, and
manhua. Good alternative when MangaDex is slow or missing a title.

**WeebCentral** — HTML scraper. Large library with frequent updates. Good for manhwa
that may not be on MangaDex.

**MangaPill** — HTML scraper. Large free library. Good fallback for titles missing
from the API-based sources.

---

## Installation

1. Open **Seanime** and go to **Settings → Extensions**
2. Click **Add extension**
3. Paste one of the manifest URLs below and click **Add**
4. Repeat for each provider you want

### MangaDex

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangadex/manifest.json
```

### ComicK

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/comick/manifest.json
```

### WeebCentral

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/weebcentral/manifest.json
```

### MangaPill

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangapill/manifest.json
```

---

## Updating

When an extension receives a fix, refresh it in Seanime to pull the latest code:

1. Go to **Settings → Extensions**
2. Find the extension and click **Refresh**

If Refresh doesn't work, remove the extension and re-add it using the same manifest URL.

---

## Troubleshooting

### Extension failed to load

- Verify the manifest URL points to a raw GitHub file (starts with `raw.githubusercontent.com`)
- Check that `payloadURI` inside the manifest points to the correct `provider.js` raw URL

### No results when searching

- MangaDex and ComicK use official APIs — they are the most stable
- WeebCentral and MangaPill are HTML scrapers — a site redesign can break them temporarily
- Open an [issue](https://github.com/trashpenguin/seanime-extensions/issues) if a scraper is broken

### Chapters not loading

- Check that your Seanime server machine has internet access
- Some sites rate-limit aggressive requests — wait 30–60 seconds and retry

### Images not loading

- Each provider already sets the required `Referer` header for its CDN
- If images still fail, the CDN may be temporarily blocking your server's IP — try again later

---

## Testing

Test a provider directly in Seanime without needing GitHub or a public URL:

1. Go to **Settings → Extensions → Playground**
2. Select **Manga Provider** from the dropdown
3. Paste the full contents of `provider.js` into the editor
4. Use the built-in test interface to call `search`, `findChapters`, and `findChapterPages`

---

## Repository Structure

```text
seanime-extensions/
├── mangadex/      # MangaDex provider (official API)
├── comick/        # ComicK provider (official API)
├── weebcentral/   # WeebCentral provider (scraper)
└── mangapill/     # MangaPill provider (scraper)
```
