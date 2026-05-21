/// <reference path="./manga-provider.d.ts" />

class Provider {

    constructor() {
        this.base = "https://www.mangakakalot.gg"
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
            "Referer": referer || (this.base + "/"),
        }
    }

    _encodeQuery(query) {
        if (!query) return ""
        return query.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, "_")
    }

    _parseJsArray(str) {
        return str.split(",")
            .map(function(s) { return s.trim().replace(/^["']|["']$/g, "").replace(/\\\//g, "/") })
            .filter(Boolean)
    }

    async search(opts) {
        try {
            var query = (opts && opts.query) ? opts.query : ""
            if (!query) return []

            var searchUrl = this.base + "/search/story/" + this._encodeQuery(query)
            var res = await fetch(searchUrl, { headers: this._headers() })
            var html = await res.text()
            var results = []

            var blockRegex = /class="story_item[^"]*"([\s\S]*?)(?=class="story_item|<\/body|$)/g
            var block
            while ((block = blockRegex.exec(html)) !== null) {
                var chunk = block[1]
                var linkM = chunk.match(/href="https?:\/\/[^"]*mangakakalot\.gg\/manga\/([^"\/\s]+)"/)
                if (!linkM) continue
                var imgM = chunk.match(/src="(https?:\/\/[^"]+)"/)
                var titleM = chunk.match(/class="story_name[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/) ||
                             chunk.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/) ||
                             chunk.match(/class="h3_[^"]*"[^>]*>([^<]+)/)
                if (!titleM) continue
                results.push({
                    id: linkM[1],
                    title: titleM[1].trim(),
                    image: imgM ? imgM[1] : "",
                    synonyms: [],
                })
            }

            if (results.length === 0) {
                var linkRe = /href="https?:\/\/[^"]*mangakakalot\.gg\/manga\/([a-z0-9][a-z0-9-]*)"/gi
                var titleRe = /class="story_name[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g
                var imgRe2 = /src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi
                var ids = [], titles = [], imgs = [], lm, tm, im
                while ((lm = linkRe.exec(html)) !== null) ids.push(lm[1])
                while ((tm = titleRe.exec(html)) !== null) titles.push(tm[1].trim())
                while ((im = imgRe2.exec(html)) !== null) imgs.push(im[1])
                for (var i = 0; i < ids.length && i < titles.length; i++) {
                    results.push({ id: ids[i], title: titles[i], image: imgs[i] || "", synonyms: [] })
                }
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
            var index = 0
            var m

            var chRegex = /href="((?:https?:\/\/[^"]*mangakakalot\.gg)?\/manga\/[^"\/]+\/chapter-([^"\/\s]+))"/gi
            while ((m = chRegex.exec(html)) !== null) {
                var chapterUrl = (m[1].indexOf("http") === 0) ? m[1] : (this.base + m[1])
                if (seen[chapterUrl]) continue
                seen[chapterUrl] = true
                chapters.push({
                    id: chapterUrl,
                    url: chapterUrl,
                    title: "Chapter " + m[2],
                    chapter: m[2],
                    index: index++,
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
            var res = await fetch(chapterUrl, { headers: this._headers(this.base + "/") })
            var html = await res.text()
            var pages = []
            var m

            var cdnsM = html.match(/var\s+cdns\s*=\s*\[([\s\S]*?)\]/)
            var imagesM = html.match(/var\s+chapterImages\s*=\s*\[([\s\S]*?)\]/)
            if (cdnsM && imagesM) {
                var cdns = this._parseJsArray(cdnsM[1])
                var images = this._parseJsArray(imagesM[1])
                if (cdns.length > 0 && images.length > 0) {
                    var cdnBase = cdns[0].endsWith("/") ? cdns[0] : (cdns[0] + "/")
                    for (var i = 0; i < images.length; i++) {
                        var path = images[i]
                        var cleanPath = path.replace(/^\//, "")
                        pages.push({
                            url: (path.indexOf("http") === 0) ? path : (cdnBase + cleanPath),
                            index: i,
                            headers: { "Referer": this.base + "/" },
                        })
                    }
                    return pages
                }
            }

            var readerM = html.match(/<div[^>]+class="[^"]*container-chapter-reader[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
            if (readerM) {
                var imgRe = /<img[^>]+src="([^"]+)"/gi
                var idx = 0
                while ((m = imgRe.exec(readerM[1])) !== null) {
                    if (/\.(jpg|jpeg|png|webp)/i.test(m[1])) {
                        pages.push({ url: m[1], index: idx++, headers: { "Referer": this.base + "/" } })
                    }
                }
                if (pages.length > 0) return pages
            }

            var imgRe2 = /<img[^>]+class="[^"]*img-loading[^"]*"[^>]+src="([^"]+)"|<img[^>]+src="([^"]+)"[^>]*class="[^"]*img-loading[^"]*"/gi
            var idx2 = 0
            while ((m = imgRe2.exec(html)) !== null) {
                pages.push({ url: m[1] || m[2], index: idx2++, headers: { "Referer": this.base + "/" } })
            }
            return pages
        } catch (e) {
            return []
        }
    }
}
