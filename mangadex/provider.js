/// <reference path="./manga-provider.d.ts" />

class Provider {

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        }
    }

    async _fetchJSON(url) {
        const res = await fetch(url)
        if (!res.ok) {
            throw new Error(`MangaDex request failed (HTTP ${res.status})`)
        }
        const data = await res.json()
        if (!data || data.result === "error") {
            throw new Error("MangaDex returned an invalid or unsuccessful response")
        }
        return data
    }

    async search(opts) {
        const query = opts && typeof opts.query === "string" ? opts.query.trim() : ""
        if (!query) return []
        const url = [
            "https://api.mangadex.org/manga",
            `?title=${encodeURIComponent(query)}`,
            "&limit=25",
            "&includes[]=cover_art",
            "&contentRating[]=safe",
            "&contentRating[]=suggestive",
            "&contentRating[]=erotica",
        ].join("")

        const data = await this._fetchJSON(url)
        if (!Array.isArray(data.data)) throw new Error("MangaDex returned an invalid manga list")

        return data.data.map(m => {
            const attrs = m.attributes
            const title =
                attrs.title["en"] ||
                attrs.title["ja-ro"] ||
                attrs.title["ja"] ||
                Object.values(attrs.title)[0] ||
                "Unknown"

            const coverRel = m.relationships.find(r => r.type === "cover_art")
            const image = coverRel && coverRel.attributes && coverRel.attributes.fileName
                ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`
                : ""

            const synonyms = (attrs.altTitles || [])
                .flatMap(t => Object.values(t))
                .slice(0, 8)

            return {
                id: m.id,
                title: title,
                synonyms: synonyms,
                year: attrs.year || undefined,
                image: image,
            }
        })
    }

    async findChapters(mangaId) {
        const chapters = []
        const seen = new Set()
        let offset = 0
        const limit = 500

        while (true) {
            const url = [
                `https://api.mangadex.org/manga/${mangaId}/feed`,
                `?limit=${limit}`,
                `&offset=${offset}`,
                "&translatedLanguage[]=en",
                "&order[chapter]=asc",
                "&order[volume]=asc",
            ].join("")

            const data = await this._fetchJSON(url)
            if (!Array.isArray(data.data)) throw new Error("MangaDex returned an invalid chapter list")

            if (data.data.length === 0) break
            let newChapters = 0

            for (let i = 0; i < data.data.length; i++) {
                const ch = data.data[i]
                if (!ch.id || seen.has(ch.id)) continue
                seen.add(ch.id)
                newChapters++
                const a = ch.attributes
                // External chapters have no pages hosted by MangaDex at-home.
                if (a.externalUrl) continue
                const chNum = a.chapter ? String(a.chapter) : "0"
                chapters.push({
                    id: ch.id,
                    url: `https://mangadex.org/chapter/${ch.id}`,
                    title: a.title ? a.title : `Chapter ${chNum}`,
                    chapter: chNum,
                    index: chapters.length,
                    language: a.translatedLanguage || "en",
                    updatedAt: a.updatedAt || undefined,
                })
            }

            offset += data.data.length
            if (newChapters === 0) {
                throw new Error("MangaDex chapter pagination made no progress")
            }
            if (typeof data.total === "number" && offset >= data.total) break
        }

        return chapters
    }

    async findChapterPages(chapterId) {
        const data = await this._fetchJSON(`https://api.mangadex.org/at-home/server/${chapterId}`)

        if (!data.baseUrl || !data.chapter || !data.chapter.hash || !Array.isArray(data.chapter.data)) {
            throw new Error("MangaDex returned invalid chapter page data")
        }

        return data.chapter.data.map((filename, i) => ({
            url: `${data.baseUrl}/data/${data.chapter.hash}/${filename}`,
            index: i,
            headers: {},
        }))
    }
}
