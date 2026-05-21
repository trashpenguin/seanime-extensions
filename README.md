# My Seanime Extensions

Custom manga provider extensions for Seanime.

**Repo:** <https://github.com/trashpenguin/seanime-extensions>

## Included Providers

| Provider     | Source          | Status     | Notes                                   |
|--------------|-----------------|------------|-----------------------------------------|
| MangaDex     | mangadex.org    | ✅ Working | Uses official API. Multi-language.      |
| WeebCentral  | weebcentral.com | ✅ Working | HTML scraper.                           |
| MangaKakalot | mangakakalot.gg | ✅ Working | Large free manga library. HTML scraper. |
| MangaFire    | mangafire.to    | ✅ Working | Bonus provider. Manga/manhwa/manhua.    |

> ❌ **MangaPlus** (mangaplus.shueisha.co.jp) — Cannot be supported.
> Their API uses encrypted Protocol Buffers (binary format) with device-based secret keys.
> It requires compiled native code to decode, which is not possible in Seanime's JS runtime.
> Official alternative: read MangaPlus directly at https://mangaplus.shueisha.co.jp

> ❌ **Bato.to** — Permanently shut down January 19, 2026 due to legal action.

---

## How to Install

1. Open **Seanime**
2. Go to the **Extensions** tab
3. Click **"Add extensions"**
4. Paste one of the manifest URLs below and click Add
5. Repeat for each provider you want

### Manifest URLs

**MangaDex:**

`https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangadex/manifest.json`

**WeebCentral:**

`https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/weebcentral/manifest.json`

**MangaKakalot:**

`https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/manganato/manifest.json`

**MangaFire:**

`https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangafire/manifest.json`

---

## Troubleshooting

**"Extension failed to load"**
- Make sure your manifest.json Raw URLs point to the correct repo file
- Make sure payloadURI in manifest.json points to the provider.js raw URL

**"No results found" when searching**
- WeebCentral and MangaNato are HTML scrapers; if the site changes its layout they may break
- MangaDex is most reliable since it uses an official API

**Chapters not loading**
- Make sure you're connected to the internet from the Seanime server
- Some sites may rate-limit or block requests; try again after a minute

**Images not loading**
- The Referer header must be set correctly — it's already in the code
- Some CDN servers check referers; this is handled in the providers

---

## Testing Without Hosting

You can test providers directly in Seanime without hosting:
1. Go to **Extensions** tab in Seanime
2. Click the **Playground** dropdown
3. Select **"Manga Provider"**
4. Paste the contents of `provider.js` directly
5. Test the `search`, `findChapters`, and `findChapterPages` methods
