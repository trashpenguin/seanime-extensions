# My Seanime Extensions

Custom manga provider extensions for [Seanime](https://seanime.rahim.app/).

**Repo:** <https://github.com/trashpenguin/seanime-extensions>

---

## Included Providers

| Provider    | Source          | Type         | Status     | Notes                              |
|-------------|-----------------|--------------|------------|------------------------------------|
| MangaDex    | mangadex.org    | Official API | ✅ Working | Most reliable. Multi-language.     |
| ComicK      | comick.io       | Official API | ✅ Working | Manga/manhwa/manhua. Multi-genre.  |
| WeebCentral | weebcentral.com | Scraper      | ✅ Working | Large manga & manhwa library.      |
| MangaPill   | mangapill.com   | Scraper      | ✅ Working | Large free manga library.          |

> ❌ **MangaPlus** — Cannot be supported. Their API uses encrypted Protocol Buffers with
> device-based secret keys that require compiled native code to decode — not possible in
> Seanime's JS runtime. Read MangaPlus directly at <https://mangaplus.shueisha.co.jp>
>
> ❌ **Bato.to** — Permanently shut down January 19, 2026 due to legal action.
>
> ❌ **MangaKakalot / NatoManga / MangaFire** — Blocked by Cloudflare or inaccessible server-side.

---

## How to Install

1. Open **Seanime**
2. Go to **Settings → Extensions**
3. Click **"Add extension"**
4. Paste a manifest URL from below and click **Add**
5. Repeat for each provider you want

### Manifest URLs

#### MangaDex

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangadex/manifest.json
```

#### ComicK

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangafire/manifest.json
```

#### WeebCentral

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/weebcentral/manifest.json
```

#### MangaPill

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/manganato/manifest.json
```

---

## Updating Extensions

If a provider stops working after a site update, pull the latest version in Seanime:

1. Go to **Settings → Extensions**
2. Find the extension and click **Refresh** (or remove and re-add it)

---

## Troubleshooting

### Extension failed to load

- Check that the manifest URL is correct and points to a raw GitHub file
- Make sure `payloadURI` in the manifest points to the correct `provider.js` raw URL

### No results found when searching

- WeebCentral and MangaPill are HTML scrapers — if the site redesigns, the scraper may break
- MangaDex and ComicK use official APIs and are the most reliable sources

### Chapters not loading

- Confirm your Seanime server has internet access
- Some sites rate-limit heavy traffic — wait a minute and try again

### Images not loading

- Referer headers are required by some CDNs and are already set in each provider
- If images still fail, the source CDN may be temporarily blocking the server's IP

---

## Testing Without Hosting

Test a provider directly in the Seanime playground without GitHub:

1. Go to **Settings → Extensions → Playground**
2. Select **"Manga Provider"** from the dropdown
3. Paste the full contents of `provider.js`
4. Use the test interface to call `search`, `findChapters`, and `findChapterPages`
