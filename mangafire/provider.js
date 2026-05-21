/// <reference path="./manga-provider.d.ts" />

class Provider {

    constructor() {
        this.api = "https://api.comick.io"
        this.cdn = "https://meo.comick.pictures"
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
            "Accept": "application/json",
        }
    }

    async search(opts) {
        try {
            var query = (opts && opts.query) ? opts.query : ""
            if (!query) return []

            var url = this.api + "/v1.0/search?q=" + encodeURIComponent(query) + "&limit=20&tachiyomi=true"
            var res = await fetch(url, { headers: this._headers() })
            var data = await res.json()

            if (!Array.isArray(data)) return []

            var results = []
            for (var i = 0; i < data.length; i++) {
                var comic = data[i]
                var slug = comic.slug || comic.hid || ""
                if (!slug) continue

                var title = comic.title || ""
                if (!title && comic.md_titles && comic.md_titles.length > 0) {
                    title = comic.md_titles[0].title || ""
                }
                if (!title) continue

                var image = ""
                if (comic.md_covers && comic.md_covers.length > 0) {
                    var cover = comic.md_covers[0]
                    if (cover.b2key) image = this.cdn + "/" + cover.b2key
                    else if (cover.gpurl) image = cover.gpurl
                }

                results.push({
                    id: slug,
                    title: title,
                    image: image,
                    synonyms: [],
                })
            }

            return results
        } catch (e) {
            return []
        }
    }

    async findChapters(slug) {
        try {
            var chapters = []
            var seen = {}
            var page = 1
            var limit = 500

            while (page <= 10) {
                var url = this.api + "/comic/" + slug + "/chapters?lang=en&limit=" + limit + "&page=" + page
                var res = await fetch(url, { headers: this._headers() })
                var data = await res.json()

                if (!data || !Array.isArray(data.chapters) || data.chapters.length === 0) break

                for (var i = 0; i < data.chapters.length; i++) {
                    var ch = data.chapters[i]
                    if (!ch.hid || seen[ch.hid]) continue
                    seen[ch.hid] = true

                    var chNum = ch.chap || String(chapters.length + 1)
                    chapters.push({
                        id: ch.hid,
                        url: "https://comick.io/comic/" + slug + "/" + ch.hid,
                        title: ch.title ? ch.title : "Chapter " + chNum,
                        chapter: chNum,
                        index: 0,
                    })
                }

                if (data.chapters.length < limit) break
                page++
            }

            chapters.reverse()
            for (var j = 0; j < chapters.length; j++) chapters[j].index = j

            return chapters
        } catch (e) {
            return []
        }
    }

    async findChapterPages(chapterHid) {
        try {
            var url = this.api + "/chapter/" + chapterHid
            var res = await fetch(url, { headers: this._headers() })
            var data = await res.json()

            var images = (data && data.chapter && Array.isArray(data.chapter.images)) ? data.chapter.images : []
            var pages = []

            for (var i = 0; i < images.length; i++) {
                var img = images[i]
                var b2key = (typeof img === "string") ? img : (img.b2key || img.url || "")
                if (!b2key) continue

                var imageUrl = b2key.startsWith("http") ? b2key : (this.cdn + "/" + b2key)
                pages.push({
                    url: imageUrl,
                    index: i,
                    headers: { "Referer": "https://comick.io/" },
                })
            }

            return pages
        } catch (e) {
            return []
        }
    }
}
