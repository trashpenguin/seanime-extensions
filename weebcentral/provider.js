/// <reference path="./manga-provider.d.ts" />

class Provider {

    constructor() {
        this.base = "https://weebcentral.com"
    }

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        }
    }

    _headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": this.base + "/",
        }
    }

    async _request(url, options = { headers: this._headers() }) {
        try {
            const response = await fetch(url, { ...options, timeout: 15 })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return await response.text()
        } catch (error) {
            throw new Error(`WeebCentral request failed: ${error.message}`)
        }
    }

    async search(opts) {
        var query = (opts && opts.query) ? opts.query : ""
        if (!query) return []

        var url = this.base + "/search/data?text=" + encodeURIComponent(query) + "&display_mode=Full+Display"
        const html = await this._request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": this.base + "/",
                "HX-Request": "true",
                "HX-Current-URL": this.base + "/",
            }
        })

        var results = []
        var seen = {}
        var linkRe = /href="(?:https:\/\/weebcentral\.com)?\/series\/([A-Z0-9]+)\/([^"]+)"/g
        var m

        while ((m = linkRe.exec(html)) !== null) {
            var id = m[1]
            var slug = m[2]
            if (seen[id]) continue
            seen[id] = true

            var nearby = html.slice(m.index, m.index + 800)

            var titleM = nearby.match(/class="[^"]*font-black[^"]*line-clamp[^"]*"[^>]*>([^<]+)<\/div>/)
            var title = titleM ? titleM[1].trim() : slug.replace(/-/g, " ")

            var imgM = nearby.match(/src="(https?:\/\/[^"]+)"/)
            var image = imgM ? imgM[1] : ""

            results.push({
                id: id,
                title: title,
                image: image,
                synonyms: [],
            })
        }

        return results
    }

    async findChapters(seriesId) {
        var url = this.base + "/series/" + seriesId + "/full-chapter-list"
        const html = await this._request(url)

        var chapters = []
        var seen = {}
        var chRe = /href="https:\/\/weebcentral\.com\/chapters\/([A-Z0-9]+)"/g
        var m
        var rawIndex = 0

        while ((m = chRe.exec(html)) !== null) {
            var chapterId = m[1]
            if (seen[chapterId]) continue
            seen[chapterId] = true

            var nearby = html.slice(m.index, m.index + 500)
            var numM = nearby.match(/Chapter\s+([\d.]+)/)
            var chNum = numM ? numM[1] : String(rawIndex + 1)

            chapters.push({
                id: chapterId,
                url: this.base + "/chapters/" + chapterId,
                title: "Chapter " + chNum,
                chapter: chNum,
                index: rawIndex++,
            })
        }

        if (!chapters.length) throw new Error("WeebCentral returned no chapter links")
        chapters.reverse()
        for (var i = 0; i < chapters.length; i++) chapters[i].index = i

        return chapters
    }

    async findChapterPages(chapterId) {
        var url = this.base + "/chapters/" + chapterId + "/images?is_prev=False&current_page=1&reading_style=long_strip"
        const html = await this._request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": this.base + "/chapters/" + chapterId,
                "HX-Request": "true",
                "HX-Current-URL": this.base + "/chapters/" + chapterId,
            }
        })

        var pages = []
        var seen = {}
        var imgRe = /src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|avif)[^"]*)"/gi
        var m
        var idx = 0

        while ((m = imgRe.exec(html)) !== null) {
            var imgUrl = m[1]
            if (seen[imgUrl]) continue
            if (/\/(logo|icon|avatar|banner|ad)\//i.test(imgUrl)) continue
            seen[imgUrl] = true
            pages.push({
                url: imgUrl,
                index: idx++,
                headers: { "Referer": this.base + "/" },
            })
        }

        if (!pages.length) throw new Error("WeebCentral reader returned no page images")
        return pages
    }
}
