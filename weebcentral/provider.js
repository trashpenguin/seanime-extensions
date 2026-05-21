/// <reference path="./manga-provider.d.ts" />

class Provider {

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        }
    }

    _headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://weebcentral.com/",
        }
    }

    async search(opts) {
        const query = encodeURIComponent(opts.query)
        const url = `https://weebcentral.com/search?text=${query}&limit=20&official=Any&display_mode=Minimal%20Display`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const results = []
        // Match: href="/series/{ULID}/{slug}" patterns
        const seriesRegex = /href="\/series\/([A-Z0-9]+)\/([^"]+)"/g
        const imgRegex = /<img[^>]+src="(https:\/\/[^"]+)"/g
        const titleRegex = /<strong[^>]*>([^<]+)<\/strong>/g

        const ids = []
        let m
        while ((m = seriesRegex.exec(html)) !== null) {
            // deduplicate
            if (!ids.find(x => x.id === m[1])) {
                ids.push({ id: m[1], slug: m[2] })
            }
        }

        const imgs = []
        while ((m = imgRegex.exec(html)) !== null) {
            if (m[1].includes("cover") || m[1].includes("thumb") || m[1].includes("cdn")) {
                imgs.push(m[1])
            }
        }

        const titles = []
        while ((m = titleRegex.exec(html)) !== null) {
            const t = m[1].trim()
            if (t.length > 0 && t.length < 200) titles.push(t)
        }

        for (let i = 0; i < ids.length; i++) {
            const { id, slug } = ids[i]
            const title = titles[i] || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
            results.push({
                id: id,
                title: title,
                image: imgs[i] || "",
                synonyms: [],
            })
        }

        return results
    }

    async findChapters(seriesId) {
        const url = `https://weebcentral.com/series/${seriesId}/full-chapter-list`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const chapters = []
        // Match chapter links: href="/chapters/{id}"
        const chRegex = /href="\/chapters\/([A-Z0-9]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/g
        let m
        let rawIndex = 0

        while ((m = chRegex.exec(html)) !== null) {
            const chapterId = m[1]
            const titleText = m[2].trim()
            const numMatch = titleText.match(/[\d]+(?:\.\d+)?/)
            const chNum = numMatch ? numMatch[0] : String(rawIndex + 1)

            chapters.push({
                id: chapterId,
                url: `https://weebcentral.com/chapters/${chapterId}`,
                title: titleText,
                chapter: chNum,
                index: rawIndex++,
            })
        }

        // Fallback: just grab chapter IDs from links
        if (chapters.length === 0) {
            const fallback = /href="\/chapters\/([A-Z0-9]+)"/g
            while ((m = fallback.exec(html)) !== null) {
                const chapterId = m[1]
                chapters.push({
                    id: chapterId,
                    url: `https://weebcentral.com/chapters/${chapterId}`,
                    title: `Chapter ${rawIndex + 1}`,
                    chapter: String(rawIndex + 1),
                    index: rawIndex++,
                })
            }
        }

        // WeebCentral lists newest first - reverse for ascending order
        chapters.reverse()
        for (let i = 0; i < chapters.length; i++) chapters[i].index = i

        return chapters
    }

    async findChapterPages(chapterId) {
        // WeebCentral has a dedicated images endpoint
        const url = `https://weebcentral.com/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`
        const res = await fetch(url, {
            headers: {
                ...this._headers(),
                "Referer": `https://weebcentral.com/chapters/${chapterId}`,
                "X-Requested-With": "XMLHttpRequest",
            }
        })
        const html = await res.text()

        const pages = []
        // Match image src/data-src attributes
        const imgRegex = /<img[^>]+(?:src|data-src)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp|avif)[^"]*)"/gi
        let m
        let index = 0

        while ((m = imgRegex.exec(html)) !== null) {
            pages.push({
                url: m[1],
                index: index++,
                headers: {
                    "Referer": "https://weebcentral.com/",
                },
            })
        }

        // Fallback: any CDN image URL
        if (pages.length === 0) {
            const fallback = /"(https:\/\/cdn[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi
            while ((m = fallback.exec(html)) !== null) {
                pages.push({
                    url: m[1],
                    index: index++,
                    headers: { "Referer": "https://weebcentral.com/" },
                })
            }
        }

        return pages
    }
}
