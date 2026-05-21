/// <reference path="./manga-provider.d.ts" />

class Provider {

    getSettings() {
        return {
            supportsMultiLanguage: true,
            supportsMultiScanlator: false,
        }
    }

    async search(opts) {
        const url = [
            "https://api.mangadex.org/manga",
            `?title=${encodeURIComponent(opts.query)}`,
            "&limit=25",
            "&includes[]=cover_art",
            "&contentRating[]=safe",
            "&contentRating[]=suggestive",
            "&contentRating[]=erotica",
        ].join("")

        const res = await fetch(url)
        const data = await res.json()
        if (!data.data) return []

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

            const res = await fetch(url)
            const data = await res.json()

            if (!data.data || data.data.length === 0) break

            for (let i = 0; i < data.data.length; i++) {
                const ch = data.data[i]
                const a = ch.attributes
                const chNum = a.chapter ? String(a.chapter) : "0"
                chapters.push({
                    id: ch.id,
                    url: `https://mangadex.org/chapter/${ch.id}`,
                    title: a.title ? a.title : `Chapter ${chNum}`,
                    chapter: chNum,
                    index: offset + i,
                    language: a.translatedLanguage || "en",
                    updatedAt: a.updatedAt || undefined,
                })
            }

            offset += data.data.length
            if (offset >= (data.total || 0)) break
        }

        return chapters
    }

    async findChapterPages(chapterId) {
        const res = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`)
        const data = await res.json()

        if (!data.baseUrl || !data.chapter) return []

        return data.chapter.data.map((filename, i) => ({
            url: `${data.baseUrl}/data/${data.chapter.hash}/${filename}`,
            index: i,
            headers: {},
        }))
    }
}
