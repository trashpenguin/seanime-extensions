# My Seanime Extensions

Custom manga provider extensions for Seanime.

## Included Providers

| Provider    | Source               | Status      | Notes                              |
|-------------|----------------------|-------------|-------------------------------------|
| MangaDex    | mangadex.org         | ✅ Working  | Uses official API. Multi-language.  |
| WeebCentral | weebcentral.com      | ✅ Working  | HTML scraper.                        |
| MangaNato   | manganato.com        | ✅ Working  | HTML scraper.                        |
| MangaFire   | mangafire.to         | ✅ Working  | Bonus provider. Manga/manhwa/manhua. |

> ❌ **MangaPlus** (mangaplus.shueisha.co.jp) — Cannot be supported.
> Their API uses encrypted Protocol Buffers (binary format) with device-based secret keys.
> It requires compiled native code to decode, which is not possible in Seanime's JS runtime.
> Official alternative: read MangaPlus directly at https://mangaplus.shueisha.co.jp

> ❌ **Bato.to** — Permanently shut down January 19, 2026 due to legal action.

---

## How to Host & Install (GitHub Gist Method — Easiest)

### Step 1: Create a GitHub account
Go to https://github.com and create a free account if you don't have one.

### Step 2: Create a Gist for each provider

Go to https://gist.github.com

For **each provider**, you need to create **2 files** in one Gist:
- `manifest.json`
- `provider.js`

#### Example: Setting up MangaDex

1. Go to https://gist.github.com/new
2. In the first filename box, type: `manifest.json`
3. Paste the contents of `mangadex/manifest.json`
4. Click **"Add file"**
5. In the second filename box, type: `provider.js`
6. Paste the contents of `mangadex/provider.js`
7. Click **"Create secret gist"** (or public, either works)

After creating the Gist:
1. Click on `manifest.json` in your Gist
2. Click the **"Raw"** button — this opens a URL like:
   `https://gist.githubusercontent.com/yourusername/abc123.../raw/.../manifest.json`
3. Copy that URL

Then click on `provider.js`:
1. Click the **"Raw"** button — URL like:
   `https://gist.githubusercontent.com/yourusername/abc123.../raw/.../provider.js`
2. Copy that URL too

### Step 3: Update your manifest.json

Go back to your Gist and edit `manifest.json`:
- Replace `"REPLACE_WITH_YOUR_RAW_MANIFEST_URL"` with your manifest Raw URL
- Replace `"REPLACE_WITH_YOUR_RAW_PROVIDER_JS_URL"` with your provider.js Raw URL

Save the Gist.

### Step 4: Add to Seanime

1. Open **Seanime**
2. Go to the **Extensions** tab
3. Click **"Add extensions"**
4. Paste your **manifest.json Raw URL**
5. Click Add — done!

Repeat Steps 2–4 for each provider (WeebCentral, MangaNato, MangaFire).

---

## Alternative: GitHub Repository Method

1. Create a new GitHub repository
2. Upload all the provider folders into it
3. For each `manifest.json`, get the Raw URL:
   `https://raw.githubusercontent.com/YOURUSERNAME/YOURREPO/main/mangadex/manifest.json`
4. Update `manifestURI` and `payloadURI` in each `manifest.json` with their Raw URLs
5. Add each manifest URL to Seanime as above

---

## Troubleshooting

**"Extension failed to load"**
- Make sure your manifest.json Raw URLs point to the correct Gist/repo file
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
