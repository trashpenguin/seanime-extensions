// Endpoint conventions based on Seanime-contributions/Seanime-Providers.
// See THIRD_PARTY_NOTICES.md for the upstream MIT license.
class Provider {
    constructor() {
        this.base = "https://atsu.moe"
        this.cdn = "https://cdn.atsu.moe"
    }

    getSettings() {
        return { supportsMultiLanguage: false, supportsMultiScanlator: false }
    }

    async _fetchJSON(url, referer) {
        const response = await fetch(url, {
            headers: { "Accept": "application/json", "Referer": referer || this.base + "/" },
        })
        if (!response.ok) throw new Error(`Atsumaru request failed (HTTP ${response.status})`)
        const data = await response.json()
        if (!data || typeof data !== "object") throw new Error("Atsumaru returned an invalid response")
        return data
    }

    _imageURL(value) {
        if (typeof value !== "string" || !value) return ""
        if (value.startsWith("//")) return "https:" + value
        if (/^https?:\/\//i.test(value)) return value
        if (value.startsWith("/")) return this.cdn + value
        return ""
    }

    async search(opts) {
        const query = opts && typeof opts.query === "string" ? opts.query.trim() : ""
        if (!query) return []
        const data = await this._fetchJSON(`${this.base}/collections/manga/documents/search?q=${encodeURIComponent(query)}&query_by=title%2CenglishTitle%2CotherNames`)
        if (!Array.isArray(data.hits)) throw new Error("Atsumaru returned an invalid search response")
        const results = []
        const seen = new Set()
        for (const hit of data.hits) {
            const manga = hit && hit.document
            if (!manga || !manga.id || !manga.title || seen.has(String(manga.id))) continue
            const id = String(manga.id)
            seen.add(id)
            const synonyms = (Array.isArray(manga.otherNames) ? manga.otherNames : []).filter(title => typeof title === "string")
            if (manga.englishTitle && manga.englishTitle !== manga.title) synonyms.push(manga.englishTitle)
            results.push({
                id, title: manga.title,
                image: this._imageURL(manga.posterMedium || manga.poster),
                synonyms: Array.from(new Set(synonyms)),
                year: manga.releaseYear || manga.year || undefined,
            })
        }
        return results
    }

    async findChapters(mangaId) {
        if (typeof mangaId !== "string" || !mangaId || mangaId.includes("|")) throw new Error("Atsumaru received an invalid manga ID")
        const data = await this._fetchJSON(`${this.base}/api/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`)
        if (!Array.isArray(data.chapters)) throw new Error("Atsumaru returned an invalid chapter list")
        const chapters = []
        const seen = new Set()
        for (const chapter of data.chapters) {
            if (!chapter || !chapter.id || chapter.number === null || chapter.number === undefined || chapter.number === "" || !Number.isFinite(Number(chapter.number))) continue
            const id = String(chapter.id)
            if (seen.has(id) || id.includes("|")) continue
            seen.add(id)
            chapters.push({
                id: `${mangaId}|${id}`,
                url: `${this.base}/read/${encodeURIComponent(mangaId)}/${encodeURIComponent(id)}`,
                title: chapter.title || `Chapter ${chapter.number}`,
                chapter: String(chapter.number),
                index: 0,
            })
        }
        chapters.sort((a, b) => Number(a.chapter) - Number(b.chapter))
        chapters.forEach((chapter, index) => { chapter.index = index })
        return chapters
    }

    async findChapterPages(chapterId) {
        const parts = typeof chapterId === "string" ? chapterId.split("|") : []
        if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Atsumaru received an invalid chapter ID")
        const mangaId = encodeURIComponent(parts[0])
        const id = encodeURIComponent(parts[1])
        const referer = `${this.base}/read/${mangaId}/${id}`
        const data = await this._fetchJSON(`${this.base}/api/read/chapter?mangaId=${mangaId}&chapterId=${id}`, referer)
        if (!data.readChapter || !Array.isArray(data.readChapter.pages)) throw new Error("Atsumaru returned invalid reader page data")
        const images = data.readChapter.pages.filter(page => page && this._imageURL(page.image))
        images.sort((a, b) => Number(a.number) - Number(b.number))
        const pages = []
        const seen = new Set()
        for (const image of images) {
            const url = this._imageURL(image.image)
            if (seen.has(url)) continue
            seen.add(url)
            pages.push({ url, index: pages.length, headers: { "Referer": referer } })
        }
        if (!pages.length) throw new Error("Atsumaru reader returned no pages")
        return pages
    }
}
