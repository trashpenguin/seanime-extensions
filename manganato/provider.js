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
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": referer || "https://www.natomanga.com/",
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
        const url = `https://www.natomanga.com/search/story/${encoded}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const results = []

        // Primary: story_item blocks
        const blockRegex = /class="story_item[^"]*"([\s\S]*?)(?=class="story_item|$)/g
        let block
        while ((block = blockRegex.exec(html)) !== null) {
            const chunk = block[1]
            const linkM = chunk.match(/href="(https:\/\/(?:www\.)?natomanga\.com\/manga\/([a-z0-9][a-z0-9-]*))"/)
            const imgM = chunk.match(/src="(https:\/\/[^"]+)"/)
            const titleM = chunk.match(/class="(?:h3_[^"]*|story_name[^"]*)"[^>]*>([^<]+)/) ||
                           chunk.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)/)

            if (linkM && titleM) {
                results.push({
                    id: linkM[2],
                    title: titleM[1].trim(),
                    image: imgM ? imgM[1] : "",
                    synonyms: [],
                })
            }
        }

        // Fallback: flat regex scan
        if (results.length === 0) {
            const linkRe = /href="https:\/\/(?:www\.)?natomanga\.com\/manga\/([a-z0-9][a-z0-9-]*)"/g
            const titleRe = /class="(?:h3_[^"]*|story_name[^"]*)"[^>]*>([^<]+)</g
            const imgRe = /<img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g

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
        const url = `https://www.natomanga.com/manga/${mangaId}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const chapters = []
        let m
        let index = 0

        // Primary: match chapter links with inline anchor text for title
        const chRegex = /href="(https:\/\/(?:www\.)?natomanga\.com\/manga\/[^\/]+\/chapter-([^"\/\s]+))"[^>]*>\s*([^<]*)/g
        while ((m = chRegex.exec(html)) !== null) {
            const title = m[3].trim() || `Chapter ${m[2]}`
            if (!chapters.find(c => c.id === m[1])) {
                chapters.push({
                    id: m[1],
                    url: m[1],
                    title: title,
                    chapter: m[2],
                    index: index++,
                })
            }
        }

        // Fallback: just grab chapter URLs
        if (chapters.length === 0) {
            const re = /href="(https:\/\/(?:www\.)?natomanga\.com\/manga\/[^\/]+\/chapter-([^"\/\s]+))"/g
            while ((m = re.exec(html)) !== null) {
                if (!chapters.find(c => c.id === m[1])) {
                    chapters.push({
                        id: m[1],
                        url: m[1],
                        title: `Chapter ${m[2]}`,
                        chapter: m[2],
                        index: index++,
                    })
                }
            }
        }

        // Site lists newest first — reverse to ascending order
        chapters.reverse()
        for (let i = 0; i < chapters.length; i++) chapters[i].index = i

        return chapters
    }

    async findChapterPages(chapterUrl) {
        const res = await fetch(chapterUrl, {
            headers: this._headers("https://www.natomanga.com/")
        })
        const html = await res.text()

        const pages = []
        let m
        let index = 0

        // class before src
        const imgRe = /<img[^>]+class="[^"]*img-loading[^"]*"[^>]+src="([^"]+)"/g
        while ((m = imgRe.exec(html)) !== null) {
            pages.push({ url: m[1], index: index++, headers: { "Referer": "https://www.natomanga.com/" } })
        }

        // src before class
        if (pages.length === 0) {
            const imgRe2 = /<img[^>]+src="([^"]+)"[^>]+class="[^"]*img-loading[^"]*"/g
            while ((m = imgRe2.exec(html)) !== null) {
                pages.push({ url: m[1], index: index++, headers: { "Referer": "https://www.natomanga.com/" } })
            }
        }

        // Fallback: CDN image URLs
        if (pages.length === 0) {
            const fallback = /src="(https:\/\/s\d+\.[^"]+\.(?:jpg|jpeg|png|webp))"/g
            while ((m = fallback.exec(html)) !== null) {
                pages.push({ url: m[1], index: index++, headers: { "Referer": "https://www.natomanga.com/" } })
            }
        }

        return pages
    }
}
