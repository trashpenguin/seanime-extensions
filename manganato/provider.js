/// <reference path="./manga-provider.d.ts" />

class Provider {

    constructor() {
        this.base = "https://www.natomanga.com"
    }

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
            "Referer": referer || this.base + "/",
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
        const searchUrl = `${this.base}/search/story/${this._encodeQuery(opts.query)}`
        const res = await fetch(searchUrl, { headers: this._headers() })
        const html = await res.text()
        const results = []

        // Each result is in a div.story_item block
        const blockRegex = /<div[^>]+class="[^"]*story_item[^"]*"[\s\S]*?<\/div>\s*<\/div>/g
        let block
        while ((block = blockRegex.exec(html)) !== null) {
            const chunk = block[0]
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
        const pageUrl = `${this.base}/manga/${mangaId}`
        const res = await fetch(pageUrl, { headers: this._headers() })
        const html = await res.text()

        const chapters = []
        const seen = new Set()
        let index = 0
        let m

        // Chapter hrefs can be relative (/manga/{slug}/chapter-N) or absolute
        const chRegex = /href="((?:https?:\/\/[^"]*natomanga\.com)?\/manga\/[^"\/]+\/chapter-([^"\/\s]+))"/gi
        while ((m = chRegex.exec(html)) !== null) {
            const chapterUrl = m[1].startsWith("http") ? m[1] : this.base + m[1]
            if (seen.has(chapterUrl)) continue
            seen.add(chapterUrl)
            const chNum = m[2]
            chapters.push({
                id: chapterUrl,
                url: chapterUrl,
                title: `Chapter ${chNum}`,
                chapter: chNum,
                index: index++,
            })
        }

        // Reverse: site lists newest first, we want ascending
        chapters.reverse()
        for (let i = 0; i < chapters.length; i++) chapters[i].index = i
        return chapters
    }

    async findChapterPages(chapterUrl) {
        const res = await fetch(chapterUrl, { headers: this._headers(this.base + "/") })
        const html = await res.text()
        const pages = []
        let m

        // Primary: var cdns = [...]; var chapterImages = [...];
        const cdnsM = html.match(/var\s+cdns\s*=\s*\[([\s\S]*?)\]/)
        const imagesM = html.match(/var\s+chapterImages\s*=\s*\[([\s\S]*?)\]/)
        if (cdnsM && imagesM) {
            const cdns = this._parseJsArray(cdnsM[1])
            const images = this._parseJsArray(imagesM[1])
            if (cdns.length > 0 && images.length > 0) {
                const cdnBase = cdns[0].endsWith("/") ? cdns[0] : cdns[0] + "/"
                images.forEach((path, i) => {
                    const cleanPath = path.replace(/^\//, "")
                    pages.push({
                        url: path.startsWith("http") ? path : cdnBase + cleanPath,
                        index: i,
                        headers: { "Referer": this.base + "/" },
                    })
                })
                return pages
            }
        }

        // Fallback A: div.container-chapter-reader img
        const readerM = html.match(/<div[^>]+class="[^"]*container-chapter-reader[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        if (readerM) {
            const imgRe = /<img[^>]+src="([^"]+)"/gi
            let idx = 0
            while ((m = imgRe.exec(readerM[1])) !== null) {
                if (/\.(jpg|jpeg|png|webp)/i.test(m[1])) {
                    pages.push({ url: m[1], index: idx++, headers: { "Referer": this.base + "/" } })
                }
            }
            if (pages.length > 0) return pages
        }

        // Fallback B: img-loading class
        const imgRe = /<img[^>]+src="([^"]+)"[^>]*class="[^"]*img-loading[^"]*"|<img[^>]+class="[^"]*img-loading[^"]*"[^>]+src="([^"]+)"/gi
        let idx = 0
        while ((m = imgRe.exec(html)) !== null) {
            pages.push({ url: m[1] || m[2], index: idx++, headers: { "Referer": this.base + "/" } })
        }
        return pages
    }
}
