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
            "Referer": referer || "https://manganato.com/",
        }
    }

    _encodeQuery(query) {
        return query
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, "")
            .trim()
            .replace(/\s+/g, "_")
    }

    async search(opts) {
        const encoded = this._encodeQuery(opts.query)
        const url = `https://manganato.com/search/story/${encoded}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const results = []

        // Primary pattern: story item blocks
        const blockRegex = /class="story_item[^"]*"([\s\S]*?)(?=class="story_item|$)/g
        let block
        while ((block = blockRegex.exec(html)) !== null) {
            const chunk = block[1]
            const linkM = chunk.match(/href="(https:\/\/manganato\.com\/manga-([a-z0-9]+))"/)
            const imgM = chunk.match(/src="(https:\/\/[^"]+)"/)
            const titleM = chunk.match(/class="h3_[^"]*"[^>]*>([^<]+)/)

            if (linkM && titleM) {
                results.push({
                    id: linkM[2],
                    title: titleM[1].trim(),
                    image: imgM ? imgM[1] : "",
                    synonyms: [],
                })
            }
        }

        // Fallback: simpler patterns
        if (results.length === 0) {
            const linkRe = /href="https:\/\/manganato\.com\/manga-([a-z0-9]+)"/g
            const titleRe = /class="h3_[^"]*"[^>]*>([^<]+)</g
            const imgRe = /<img[^>]+src="(https:\/\/s\d+\.mkklcdnv6tempv3[^"]+|https:\/\/[^"]+\.(?:jpg|jpeg|png)[^"]*)"/g

            const ids = [], titles = [], imgs = []
            let m
            while ((m = linkRe.exec(html)) !== null) ids.push(m[1])
            while ((m = titleRe.exec(html)) !== null) titles.push(m[1].trim())
            while ((m = imgRe.exec(html)) !== null) imgs.push(m[1])

            for (let i = 0; i < ids.length && i < titles.length; i++) {
                results.push({
                    id: ids[i],
                    title: titles[i],
                    image: imgs[i] || "",
                    synonyms: [],
                })
            }
        }

        return results
    }

    async findChapters(mangaId) {
        // MangaNato series page: https://manganato.com/manga-{id}
        const url = `https://manganato.com/manga-${mangaId}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const chapters = []

        // Chapter links pattern on MangaNato:
        // href="https://chapmanganato.to/manga-{id}/chapter-{num}"
        const chRegex = /href="(https:\/\/chapmanganato\.to\/manga-[^\/]+\/chapter-([^"\/\s]+))"[^>]*>[\s\S]*?<span class="chapter-name[^"]*"[^>]*>([^<]+)<\/span>/g
        let m
        let index = 0

        while ((m = chRegex.exec(html)) !== null) {
            chapters.push({
                id: m[1], // full URL used as chapter ID
                url: m[1],
                title: m[3].trim(),
                chapter: m[2],
                index: index++,
            })
        }

        // Fallback: just grab all chapter URLs
        if (chapters.length === 0) {
            const re = /href="(https:\/\/chapmanganato\.to\/manga-[^\/]+\/chapter-([^"\/\s]+))"/g
            while ((m = re.exec(html)) !== null) {
                const chNum = m[2]
                if (!chapters.find(c => c.id === m[1])) {
                    chapters.push({
                        id: m[1],
                        url: m[1],
                        title: `Chapter ${chNum}`,
                        chapter: chNum,
                        index: index++,
                    })
                }
            }
        }

        // Newest listed first on MangaNato - reverse to ascending
        chapters.reverse()
        for (let i = 0; i < chapters.length; i++) chapters[i].index = i

        return chapters
    }

    async findChapterPages(chapterUrl) {
        // chapterUrl is the full URL like https://chapmanganato.to/manga-{id}/chapter-{num}
        const res = await fetch(chapterUrl, {
            headers: this._headers("https://manganato.com/")
        })
        const html = await res.text()

        const pages = []

        // MangaNato chapter images: <img class="img-loading" src="..." ...>
        const imgRe = /<img[^>]+class="[^"]*img-loading[^"]*"[^>]+src="([^"]+)"/g
        let m
        let index = 0

        while ((m = imgRe.exec(html)) !== null) {
            pages.push({
                url: m[1],
                index: index++,
                headers: {
                    "Referer": "https://chapmanganato.to/",
                },
            })
        }

        // Fallback: any CDN image
        if (pages.length === 0) {
            const fallback = /src="(https:\/\/s\d+\.[^"]+\.(?:jpg|jpeg|png|webp))"/g
            while ((m = fallback.exec(html)) !== null) {
                pages.push({
                    url: m[1],
                    index: index++,
                    headers: { "Referer": "https://chapmanganato.to/" },
                })
            }
        }

        return pages
    }
}
