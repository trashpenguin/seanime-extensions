/// <reference path="./manga-provider.d.ts" />

class Provider {

    constructor() {
        this.base = "https://mangapill.com"
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
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Referer": this.base + "/",
        }
    }

    async search(opts) {
        try {
            var query = (opts && opts.query) ? opts.query : ""
            if (!query) return []

            var searchUrl = this.base + "/search?q=" + encodeURIComponent(query) + "&type=&status="
            var res = await fetch(searchUrl, { headers: this._headers() })
            var html = await res.text()
            var results = []
            var seen = {}

            var linkRe = /href="(\/manga\/(\d+\/[^"]+))"/g
            var m
            while ((m = linkRe.exec(html)) !== null) {
                var path = m[1]
                var id = m[2]
                if (seen[id]) continue
                seen[id] = true

                var afterLink = html.slice(m.index, m.index + 800)

                var imgM = afterLink.match(/data-src="([^"]+)"/)
                var titleM = afterLink.match(/class="[^"]*font-black[^"]*line-clamp[^"]*"[^>]*>([^<]+)<\/div>/)

                if (!titleM) continue

                results.push({
                    id: id,
                    title: titleM[1].trim(),
                    image: imgM ? imgM[1] : "",
                    synonyms: [],
                })
            }

            return results
        } catch (e) {
            return []
        }
    }

    async findChapters(mangaId) {
        try {
            var pageUrl = this.base + "/manga/" + mangaId
            var res = await fetch(pageUrl, { headers: this._headers() })
            var html = await res.text()

            var chapters = []
            var seen = {}
            var chRe = /href="(\/chapters\/([^"]+))"/g
            var m

            while ((m = chRe.exec(html)) !== null) {
                var chPath = m[1]
                var chSlug = m[2]
                if (seen[chSlug]) continue
                seen[chSlug] = true

                var numM = chSlug.match(/chapter-([0-9.]+)$/)
                var chNum = numM ? numM[1] : chSlug

                chapters.push({
                    id: this.base + chPath,
                    url: this.base + chPath,
                    title: "Chapter " + chNum,
                    chapter: chNum,
                    index: 0,
                })
            }

            chapters.reverse()
            for (var j = 0; j < chapters.length; j++) chapters[j].index = j
            return chapters
        } catch (e) {
            return []
        }
    }

    async findChapterPages(chapterUrl) {
        try {
            var res = await fetch(chapterUrl, { headers: this._headers() })
            var html = await res.text()
            var pages = []
            var seen = {}
            var imgRe = /src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi
            var m
            var idx = 0

            while ((m = imgRe.exec(html)) !== null) {
                var url = m[1]
                if (seen[url]) continue
                if (/\/(ad|logo|banner|icon|favicon)/i.test(url)) continue
                seen[url] = true
                pages.push({
                    url: url,
                    index: idx++,
                    headers: { "Referer": this.base + "/" },
                })
            }

            return pages
        } catch (e) {
            return []
        }
    }
}
