// Endpoint and reader-array conventions based on Seanime-contributions/Seanime-Providers.
// See THIRD_PARTY_NOTICES.md for the upstream MIT license.
class Provider {
    constructor() {
        this.base = "https://mangakatana.com"
    }

    getSettings() {
        return { supportsMultiLanguage: false, supportsMultiScanlator: false }
    }

    async _fetchHTML(url) {
        const response = await fetch(url, {
            headers: { "Accept": "text/html", "Referer": this.base + "/" },
        })
        if (!response.ok) throw new Error(`MangaKatana request failed (HTTP ${response.status})`)
        return { html: await response.text(), url: response.url || url }
    }

    _decode(text) {
        const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " }
        return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, value) => {
            if (value[0] !== "#") return entities[value.toLowerCase()]
            const number = value[1].toLowerCase() === "x" ? parseInt(value.slice(2), 16) : parseInt(value.slice(1), 10)
            return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity
        })
    }

    _text(html) {
        return this._decode(html.replace(/<[^>]*>/g, "")).trim()
    }

    _attr(tag, name) {
        const match = tag.match(new RegExp("(?:^|\\s)" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i"))
        return match ? this._decode(match[2]).trim() : ""
    }

    _imageURL(value) {
        if (!value) return ""
        if (value.startsWith("//")) return "https:" + value
        if (/^https?:\/\//i.test(value)) return value
        if (value.startsWith("/")) return this.base + value
        return ""
    }

    _mangaId(url) {
        const match = url.match(/^(?:https?:\/\/mangakatana\.com)?\/manga\/([a-z0-9._-]+)\/?(?:[?#].*)?$/i)
        return match ? match[1] : ""
    }

    _meta(html, property) {
        const tags = html.match(/<meta\b[^>]*>/gi) || []
        for (const tag of tags) {
            if (this._attr(tag, "property") === property) return this._attr(tag, "content")
        }
        return ""
    }

    async search(opts) {
        const query = opts && typeof opts.query === "string" ? opts.query.trim() : ""
        if (!query) return []
        const { html, url } = await this._fetchHTML(`${this.base}/?search=${encodeURIComponent(query)}&search_by=m_name`)
        const redirectId = this._mangaId(url)
        if (redirectId) {
            const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
            const title = this._meta(html, "og:title") || (heading ? this._text(heading[1]) : "")
            if (!title) throw new Error("MangaKatana returned an invalid manga page")
            return [{ id: redirectId, title, image: this._imageURL(this._meta(html, "og:image")), synonyms: [] }]
        }

        const cards = []
        const divs = /<div\b[^>]*>/gi
        let match
        while ((match = divs.exec(html)) !== null) {
            if (this._attr(match[0], "class").split(/\s+/).includes("item")) cards.push(match.index)
        }
        const results = []
        const seen = new Set()
        for (let i = 0; i < cards.length; i++) {
            const card = html.slice(cards[i], cards[i + 1] || html.length)
            const headings = /<h3\b([^>]*)>([\s\S]*?)<\/h3>/gi
            let heading
            while ((heading = headings.exec(card)) !== null) {
                if (!this._attr(heading[1], "class").split(/\s+/).includes("title")) continue
                const link = heading[2].match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i)
                if (!link) continue
                const id = this._mangaId(this._attr(link[1], "href"))
                const title = this._text(link[2])
                if (!id || !title || seen.has(id)) continue
                seen.add(id)
                const img = card.match(/<img\b[^>]*>/i)
                const image = img ? this._imageURL(this._attr(img[0], "data-src") || this._attr(img[0], "lazy-src") || this._attr(img[0], "src")) : ""
                results.push({ id, title, image, synonyms: [] })
            }
        }
        return results
    }

    async findChapters(mangaId) {
        if (typeof mangaId !== "string" || !/^[a-z0-9._-]+$/i.test(mangaId) || /^\.+$/.test(mangaId)) {
            throw new Error("MangaKatana received an invalid manga ID")
        }
        const { html } = await this._fetchHTML(`${this.base}/manga/${mangaId}`)
        const links = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
        const chapters = []
        const seen = new Set()
        let link
        while ((link = links.exec(html)) !== null) {
            const href = this._attr(link[1], "href")
            const match = href.match(/^(?:https?:\/\/mangakatana\.com)?\/manga\/([a-z0-9._-]+)\/c(\d+(?:\.\d+)?)\/?(?:[?#].*)?$/i)
            if (!match || match[1] !== mangaId) continue
            const id = `${mangaId}/c${match[2]}`
            if (seen.has(id)) continue
            seen.add(id)
            chapters.push({ id, url: `${this.base}/manga/${id}`, title: this._text(link[2]) || `Chapter ${match[2]}`, chapter: match[2], index: 0 })
        }
        if (!chapters.length) throw new Error("MangaKatana returned no readable chapters; the source layout may have changed")
        chapters.sort((a, b) => Number(a.chapter) - Number(b.chapter))
        chapters.forEach((chapter, index) => { chapter.index = index })
        return chapters
    }

    async findChapterPages(chapterId) {
        if (typeof chapterId !== "string" || !/^[a-z0-9._-]+\/c\d+(?:\.\d+)?$/i.test(chapterId) || chapterId.startsWith("../") || chapterId.startsWith("./")) {
            throw new Error("MangaKatana received an invalid chapter ID")
        }
        const { html } = await this._fetchHTML(`${this.base}/manga/${chapterId}`)
        const array = html.match(/\b(?:var|let|const)\s+thzq\s*=\s*(\[[\s\S]*?\])\s*;/i)
        if (!array) throw new Error("MangaKatana reader page data is missing")
        // Extract string literals only. Never execute remote scripts.
        const strings = /(["'])((?:\\.|(?!\1)[^\\])*)\1/g
        const pages = []
        const seen = new Set()
        let match
        while ((match = strings.exec(array[1])) !== null) {
            const value = match[2].replace(/\\([\\/"'])/g, "$1").replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
            const url = this._imageURL(value)
            if (!url || seen.has(url)) continue
            seen.add(url)
            pages.push({ url, index: pages.length, headers: { "Referer": this.base + "/" } })
        }
        if (!pages.length) throw new Error("MangaKatana reader returned no pages")
        return pages
    }
}
