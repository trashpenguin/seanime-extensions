# Seanime Manga Extensions

One installable manga collection for [Seanime](https://seanime.rahim.app/) — a self-hosted anime and manga manager.
It bundles MangaDex, WeebCentral, MangaPill, MangaKatana and Atsumaru.
The individual source extensions are also available.

> Extensions are JavaScript plugins that let Seanime fetch manga chapters and pages from external sources.
> All providers run server-side inside Seanime's JS runtime.

---

## Providers

| Provider    | Source          | Type         | Version | Status     |
|-------------|-----------------|--------------|---------|------------|
| MangaDex    | mangadex.org    | Official API | 1.0.1   | ✅ Working |
| ComicK      | comick.io       | Official API | 2.0.1   | Unavailable in Manga Collection |
| WeebCentral | weebcentral.com | Scraper      | 1.1.0   | ✅ Working |
| MangaPill   | mangapill.com   | Scraper      | 4.0.0   | ✅ Working |
| MangaKatana | mangakatana.com | Scraper      | 1.0.0   | Live smoke check passed; verify in Seanime |
| Atsumaru    | atsu.moe        | Site JSON API | 1.0.0  | Live smoke check passed; verify in Seanime |

### Provider Details

**MangaDex** — Uses the official MangaDex API to search manga and fetch English
chapters. Multiple scanlation groups may appear, but language and scanlator selection
are not supported. External chapters are omitted because MangaDex does not host their pages.
API failures are reported as errors so they can be distinguished from empty results.

**ComicK** — Uses the configured ComicK API. Its search endpoint returned HTTP 404
during collection verification on October 14, 2026. A retry on November 12, 2026
timed out. Collection searches skip
ComicK. If you previously matched a title to ComicK, use **Manual match** to
select another source.

**WeebCentral** — HTML scraper. Large library with frequent updates. Good for manhwa
that may not be on MangaDex.

**MangaPill** — HTML scraper. Large free library. Good fallback for titles missing
from the API-based sources.

**MangaKatana** — English manga provider. Supports search result cards and
single-result redirects, filters chapters to the selected series, and reads page
URLs from the site's reader data without executing its scripts.

**Atsumaru** — English manga provider for atsu.moe. Uses the site's JSON endpoints
for search, chapter lists and reader pages. Returns chapters and pages in numeric
reading order. These endpoints are not a documented public API and may change.

Both new providers report request and parsing failures as errors. Their live smoke
checks covered Naruto search and chapter lists, sample reader page lists and image
retrieval on October 14, 2026. MangaKatana also produced intermittent connection
timeouts during verification; retry if the site is temporarily unreachable.
Playback inside Seanime has not been verified.

---

## Installation

### Manga Collection — five active sources in one extension

1. Open **Seanime** and go to **Settings → Extensions**
2. Click **Add extension**
3. Paste this manifest URL and click **Add**:

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/collection/manifest.json
```

4. Open a manga and select **Manga Collection** as its provider.
5. Open **Manual match**, search the title, and select the result labelled with the
   source you want, such as `Naruto [MangaKatana]` or `Naruto [Atsumaru]`. Confirm
   the match to use that source for this manga.

The collection queries its five active sources in parallel. Results from different sources stay separate,
and chapters and page requests go to the selected source. Original manga titles
are retained as synonyms for Seanime's automatic matching; use **Manual match**
to make an explicit source choice or switch sources later.

An unavailable source is logged and skipped during search. If all sources fail,
the collection reports an error. Requests use a 15-second timeout in Seanime.
Switching sources requires a new manual match; reader pages are never automatically
mixed across sources. Refresh **Manga Collection** to update all bundled adapters.

The live collection smoke check returned 104 Naruto search results from five
sources on October 14, 2026; ComicK returned HTTP 404 and was skipped. Selecting
the Atsumaru result returned 701 chapters, 59 pages for chapter 1, and an image
with HTTP 200. This verifies the bundled routing using Node.js, not playback in
Seanime; use the Playground to check that runtime.

The collection introduces its own manga and chapter IDs. Installing it does not
migrate existing individual-provider mappings or downloaded chapters.

### Individual sources (optional)

To install only a specific source, paste its manifest URL below into **Add extension**.

### MangaDex

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangadex/manifest.json
```

### ComicK

This standalone adapter is available for testing the configured API. See the provider status above.

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

### MangaKatana

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/mangakatana/manifest.json
```

### Atsumaru

```text
https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/atsumaru/manifest.json
```

---

## Versioned releases and rollback

Open [GitHub Releases](https://github.com/trashpenguin/seanime-extensions/releases)
and copy the link to `collection-manifest.json` under the version you want.
Individual providers have their own `<provider>-manifest.json` assets. Paste the
asset URL into **Add extension**. Each manifest loads the provider code from the
exact release commit.

To roll back, use the manifest asset from the earlier release. Record your
current manga matches before removing or replacing an installed extension.

### Updating the main-branch install

When an extension receives a fix, refresh it in Seanime to pull the latest code:

1. Go to **Settings → Extensions**
2. Find the extension and click **Refresh**

If Refresh doesn't work, remove the extension and re-add it using the same manifest URL.

---

## Troubleshooting

### Extension failed to load

- Verify the URL opens a manifest JSON file from GitHub Releases or raw GitHub.
- Check that `payloadURI` inside the manifest points to the correct `provider.js` raw URL

### No results when searching

- MangaDex and ComicK use official APIs — they are the most stable
- WeebCentral, MangaPill and MangaKatana are HTML scrapers — a site redesign can break them temporarily
- Atsumaru uses the site's JSON endpoints; endpoint changes can also break the provider
- Open an [issue](https://github.com/trashpenguin/seanime-extensions/issues) if a scraper is broken

### Chapters not loading

- Check that your Seanime server machine has internet access
- Some sites rate-limit aggressive requests — wait 30–60 seconds and retry

### Images not loading

- Each provider already sets the required `Referer` header for its CDN
- If images still fail, the CDN may be temporarily blocking your server's IP — try again later

---

## Testing

### Automated checks

With Node.js 22 or newer, run:

```sh
npm test
```

No dependencies or installation step are required. The tests discover all provider
manifests automatically and check their interfaces. They also cover MangaDex,
MangaKatana and Atsumaru search, chapter ordering, duplicate records, page URLs and
error handling using mocked responses. GitHub Actions runs the same
checks on pushes and pull requests. These checks do not verify live source availability
or execution inside Seanime; use the Playground for those checks.

Collection tests exercise the standalone bundle with the real embedded adapters,
including parallel search, source labels, failure isolation, ID encoding and routing.
`npm test` also rejects a bundle that is out of date with its adapter sources.

### Rebuilding the collection

After editing an individual `provider.js`, `collection/router.js`, or the bundled
source list in `collection/sources.json`, regenerate the installable file:

```sh
npm run build:collection
npm test
```

Commit the updated `collection/provider.js` along with your source changes. The
bundle embeds every adapter, so it runs without fetching or evaluating provider
code at runtime. When releasing changes, bump `collection/manifest.json` as well
as any changed individual source's version.

### Release verification in Seanime

1. Install the candidate collection manifest in Seanime.
2. Use **Manual match** to find a title on MangaKatana and Atsumaru.
3. Open a chapter from each source and confirm the reader renders images in order.
4. Record the Seanime version, date, source, title and chapter in the release notes.
5. Tag the verified commit with a version such as `v1.1.0` to run the release
   workflow. It tests the checkout and publishes commit-pinned manifest assets.
6. Install from the published manifest once and repeat the reader check. Keep
   earlier release assets available for rollback.

### Seanime Playground

Test a provider directly in Seanime without needing GitHub or a public URL:

1. Go to **Settings → Extensions → Playground**
2. Select **Manga Provider** from the dropdown
3. Paste the full contents of `provider.js` into the editor
4. Use the built-in test interface to call `search`, `findChapters`, and `findChapterPages`

---

## Repository Structure

```text
seanime-extensions/
├── collection/    # Single installable extension for five active sources
├── mangadex/      # MangaDex provider (official API)
├── comick/        # ComicK provider (official API)
├── weebcentral/   # WeebCentral provider (scraper)
├── mangapill/     # MangaPill provider (scraper)
├── mangakatana/   # MangaKatana provider (scraper)
├── atsumaru/      # Atsumaru provider (site JSON API)
├── scripts/       # Collection bundle and release manifest generators
└── tests/         # Offline provider checks
```

## Credits

Endpoint conventions for the MangaKatana and Atsumaru adapters were based on
[Seanime-contributions/Seanime-Providers](https://github.com/Seanime-contributions/Seanime-Providers).
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the upstream MIT license.
