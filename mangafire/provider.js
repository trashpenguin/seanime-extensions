/// <reference path="./manga-provider.d.ts" />

class Provider {

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        }
    }

    _headers(referer) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": referer || "https://mangafire.to/",
        }
    }

    async search(opts) {
        const query = encodeURIComponent(opts.query)
        const url = `https://mangafire.to/filter?keyword=${query}&type%5B%5D=manga&type%5B%5D=manhwa&type%5B%5D=manhua&language%5B%5D=en&sort=most_relevance`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const results = []

        // MangaFire search results: /manga/{slug}.{id}
        const itemRegex = /href="\/manga\/([^"]+)\.([a-z0-9]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/g
        let m
        while ((m = itemRegex.exec(html)) !== null) {
            const slug = m[1]
            const id = m[2]
            const image = m[3]
            const title = m[4].trim()
            if (title && title.length < 300) {
                results.push({
                    id: `${slug}.${id}`,
                    title: title,
                    image: image,
                    synonyms: [],
                })
            }
        }

        // Fallback
        if (results.length === 0) {
            const linkRe = /href="\/manga\/([a-z0-9-]+\.[a-z0-9]+)"/g
            const titleRe = /<span class="name"[^>]*>([^<]+)/g
            const imgRe = /src="(https:\/\/[^"]*mangafire[^"]+\.(?:jpg|jpeg|png|webp))"/g

            const slugs = [], titles = [], imgs = []
            while ((m = linkRe.exec(html)) !== null) {
                if (!slugs.includes(m[1])) slugs.push(m[1])
            }
            while ((m = titleRe.exec(html)) !== null) titles.push(m[1].trim())
            while ((m = imgRe.exec(html)) !== null) imgs.push(m[1])

            for (let i = 0; i < slugs.length && i < titles.length; i++) {
                results.push({
                    id: slugs[i],
                    title: titles[i],
                    image: imgs[i] || "",
                    synonyms: [],
                })
            }
        }

        return results
    }

    async findChapters(mangaSlug) {
        // mangaSlug is like "one-piece.q9q"
        const url = `https://mangafire.to/manga/${mangaSlug}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const chapters = []

        // MangaFire chapter links: /read/{slug}/en/chapter-{num}
        // Chapter data is often loaded via AJAX, but the list may be in the HTML
        const chRegex = /href="\/read\/([^"]+\/en\/chapter-([^"]+))"[^>]*>[\s\S]*?(?:<span[^>]*>([^<]+)<\/span>|Chapter\s+([\d.]+))/g
        let m
        let index = 0

        while ((m = chRegex.exec(html)) !== null) {
            const path = m[1]
            const chNum = m[2]
            const chTitle = m[3] ? m[3].trim() : `Chapter ${chNum}`
            chapters.push({
                id: path,
                url: `https://mangafire.to/read/${path}`,
                title: chTitle,
                chapter: chNum,
                index: index++,
            })
        }

        // Alternative: Try the chapter list API endpoint
        if (chapters.length === 0) {
            // Extract manga numeric ID from HTML
            const idMatch = html.match(/data-id="(\d+)"/)
            if (idMatch) {
                const mangaId = idMatch[1]
                const apiUrl = `https://mangafire.to/ajax/manga/${mangaId}/chapter/en`
                const apiRes = await fetch(apiUrl, {
                    headers: {
                        ...this._headers("https://mangafire.to/"),
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "application/json, text/javascript, */*; q=0.01",
                    }
                })
                const apiData = await apiRes.json()
                const chHtml = apiData.result || apiData.html || ""

                const re = /href="\/read\/([^"]+\/en\/chapter-([^"]+))"[^>]*>[\s\S]*?Chapter\s*([\d.]+)/g
                while ((m = re.exec(chHtml)) !== null) {
                    chapters.push({
                        id: m[1],
                        url: `https://mangafire.to/read/${m[1]}`,
                        title: `Chapter ${m[3]}`,
                        chapter: m[2] || m[3],
                        index: index++,
                    })
                }
            }
        }

        // MangaFire lists newest first - reverse for ascending order
        chapters.reverse()
        for (let i = 0; i < chapters.length; i++) chapters[i].index = i

        return chapters
    }

    async findChapterPages(chapterPath) {
        // chapterPath is like "one-piece.q9q/en/chapter-1"
        const url = `https://mangafire.to/read/${chapterPath}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const pages = []

        // MangaFire page images: look for JSON array of image URLs
        const jsonMatch = html.match(/images\s*[:=]\s*(\[[\s\S]*?\])/)
        if (jsonMatch) {
            try {
                const imgs = JSON.parse(jsonMatch[1])
                for (let i = 0; i < imgs.length; i++) {
                    const src = typeof imgs[i] === "string" ? imgs[i] : (imgs[i][0] || imgs[i].url || "")
                    if (src) {
                        pages.push({
                            url: src,
                            index: i,
                            headers: { "Referer": "https://mangafire.to/" },
                        })
                    }
                }
            } catch (e) {}
        }

        // Fallback: scan HTML for image tags
        if (pages.length === 0) {
            const imgRe = /<img[^>]+(?:src|data-src|data-url)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi
            let m
            let index = 0
            while ((m = imgRe.exec(html)) !== null) {
                if (!m[1].includes("logo") && !m[1].includes("icon") && !m[1].includes("avatar")) {
                    pages.push({
                        url: m[1],
                        index: index++,
                        headers: { "Referer": "https://mangafire.to/" },
                    })
                }
            }
        }

        return pages
    }
}
