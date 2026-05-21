/// <reference path="./manga-provider.d.ts" />

const BASE = "https://www.natomanga.com"

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
            "Referer": referer || BASE + "/",
        }
    }

    _encodeQuery(query) {
        return query.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, "_")
    }

    _parseJsArray(str) {
        return str.split(",")
            .map(s => s.trim().replace(/^["']|["']$/g, "").replace(/\\\//g, "/"))
            .filter(Boolean)
    }

    async search(opts) {
        const url = `${BASE}/search/story/${this._encodeQuery(opts.query)}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()
        const results = []

        // Each result is wrapped in a div.story_item block
        const blockRegex = /<div[^>]+class="[^"]*story_item[^"]*"[\s\S]*?<\/div>\s*<\/div>/g
        let block
        while ((block = blockRegex.exec(html)) !== null) {
            const chunk = block[0]
            // href points to absolute URL: https://www.natomanga.com/manga/{slug}
            const linkM = chunk.match(/href="https?:\/\/[^"]*natomanga\.com\/manga\/([^"\/]+)"/)
            if (!linkM) continue
            const imgM = chunk.match(/<img[^>]+src="([^"]+)"/)
            const titleM = chunk.match(/class="story_name"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/) ||
                           chunk.match(/<h3[^>]*>\s*<a[^>]*>([^<]+)<\/a>/)
            if (!titleM) continue
            results.push({
                id: linkM[1],
                title: titleM[1].trim(),
                image: imgM ? imgM[1] : "",
                synonyms: [],
            })
        }

        // Fallback: plain link scan
        if (results.length === 0) {
            const linkRe = /href="https?:\/\/[^"]*natomanga\.com\/manga\/([a-z0-9][a-z0-9-]*)"/gi
            const titleRe = /class="story_name"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g
            const imgRe = /<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi
            const ids = [], titles = [], imgs = []
            let m
            while ((m = linkRe.exec(html)) !== null) ids.push(m[1])
            while ((m = titleRe.exec(html)) !== null) titles.push(m[1].trim())
            while ((m = imgRe.exec(html)) !== null) imgs.push(m[1])
            for (let i = 0; i < ids.length && i < titles.length; i++) {
                results.push({ id: ids[i], title: titles[i], image: imgs[i] || "", synonyms: [] })
            }
        }

        return results
    }

    async findChapters(mangaId) {
        const url = `${BASE}/manga/${mangaId}`
        const res = await fetch(url, { headers: this._headers() })
        const html = await res.text()

        const chapters = []
        const seen = new Set()
        let index = 0

        // Chapter hrefs are RELATIVE: /manga/{slug}/chapter-{num}
        // Also handle occasional absolute URLs on the same domain
        const chRegex = /href="((?:https?:\/\/[^"]*natomanga\.com)?\/manga\/[^"\/]+\/chapter-([^"\/\s]+))"/gi
        let m
        while ((m = chRegex.exec(html)) !== null) {
            // Resolve relative URLs to absolute
            const url = m[1].startsWith("http") ? m[1] : BASE + m[1]
            if (seen.has(url)) continue
            seen.add(url)
            const chNum = m[2]
            // Try to grab the chapter title from the nearby anchor text
            const titleM = html.slice(m.index, m.index + 200).match(/>[^<]*(?:Chapter|Ch\.?)\s*[\d.]+[^<]*</)
            const title = titleM ? titleM[0].slice(1, -1).trim() : `Chapter ${chNum}`
            chapters.push({ id: url, url: url, title: title, chapter: chNum, index: index++ })
        }

        // Reverse from newest-first to ascending order
        chapters.reverse()
        for (let i = 0; i < chapters.length; i++) chapters[i].index = i
        return chapters
    }

    async findChapterPages(chapterUrl) {
        const res = await fetch(chapterUrl, { headers: this._headers(BASE + "/") })
        const html = await res.text()
        const pages = []
        let m

        // Primary: extract from JS variables (var cdns = [...]; var chapterImages = [...];)
        const cdnsM = html.match(/var\s+cdns\s*=\s*\[([\s\S]*?)\]/)
        const imagesM = html.match(/var\s+chapterImages\s*=\s*\[([\s\S]*?)\]/)
        if (cdnsM && imagesM) {
            const cdns = this._parseJsArray(cdnsM[1])
            const images = this._parseJsArray(imagesM[1])
            if (cdns.length > 0 && images.length > 0) {
                const base = cdns[0].endsWith("/") ? cdns[0] : cdns[0] + "/"
                images.forEach((path, i) => {
                    const clean = path.replace(/^\//, "")
                    pages.push({
                        url: path.startsWith("http") ? path : base + clean,
                        index: i,
                        headers: { "Referer": BASE + "/" },
                    })
                })
                return pages
            }
        }

        // Fallback A: div.container-chapter-reader > img
        const readerM = html.match(/<div[^>]+class="[^"]*container-chapter-reader[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        if (readerM) {
            const imgRe = /<img[^>]+src="([^"]+)"/gi
            let idx = 0
            while ((m = imgRe.exec(readerM[1])) !== null) {
                if (/\.(jpg|jpeg|png|webp)/i.test(m[1])) {
                    pages.push({ url: m[1], index: idx++, headers: { "Referer": BASE + "/" } })
                }
            }
            if (pages.length > 0) return pages
        }

        // Fallback B: img-loading class
        const imgRe = /<img[^>]+src="([^"]+)"[^>]*class="[^"]*img-loading[^"]*"|<img[^>]+class="[^"]*img-loading[^"]*"[^>]+src="([^"]+)"/gi
        let idx = 0
        while ((m = imgRe.exec(html)) !== null) {
            const src = m[1] || m[2]
            pages.push({ url: src, index: idx++, headers: { "Referer": BASE + "/" } })
        }
        return pages
    }
}
