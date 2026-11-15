// Bundled with the source adapters by scripts/build-collection.js.
const UNAVAILABLE_SOURCE = "comick"
class Provider {
    getSettings() {
        return { supportsMultiLanguage: false, supportsMultiScanlator: false }
    }

    _encode(source, id) {
        return source.id + ":" + encodeURIComponent(String(id))
    }

    _decode(id) {
        if (typeof id !== "string") throw new Error("Manga Collection received an invalid ID")
        const separator = id.indexOf(":")
        if (separator < 1) throw new Error("Manga Collection received an invalid ID")
        const source = COLLECTION_SOURCES.find(source => source.id === id.slice(0, separator))
        if (!source) throw new Error("Manga Collection received an unknown source ID")
        let rawId
        try {
            rawId = decodeURIComponent(id.slice(separator + 1))
        } catch (_) {
            throw new Error("Manga Collection received an invalid encoded ID")
        }
        if (!rawId) throw new Error("Manga Collection received an invalid empty ID")
        return { source, rawId }
    }

    async _runSource(source, method, value) {
        if (source.id === UNAVAILABLE_SOURCE) {
            throw new Error("ComicK is unavailable. Use Manual match to select another source.")
        }
        const adapter = source.create((url, options) => fetch(url, { ...options, timeout: 15 }))
        try {
            const results = await adapter[method](value)
            if (!Array.isArray(results)) throw new Error("returned an invalid result list")
            return results
        } catch (error) {
            const message = error && error.message ? error.message : String(error)
            throw new Error(message.startsWith(source.name) ? message : `${source.name}: ${message}`)
        }
    }

    async search(opts) {
        const query = opts && typeof opts.query === "string" ? opts.query.trim() : ""
        if (!query) return []
        const activeSources = COLLECTION_SOURCES.filter(source => source.id !== UNAVAILABLE_SOURCE)
        const batches = await Promise.all(activeSources.map(async source => {
            try {
                return { source, results: await this._runSource(source, "search", { ...opts, query }) }
            } catch (error) {
                console.warn(`Manga Collection search skipped ${error.message}`)
                return { source, error: error.message, results: [] }
            }
        }))
        if (batches.every(batch => batch.error)) {
            throw new Error("All manga sources failed: " + batches.map(batch => batch.error).join("; "))
        }
        const results = []
        const seen = new Set()
        for (const batch of batches) {
            for (const manga of batch.results) {
                if (!manga || !manga.id || typeof manga.title !== "string" || !manga.title.trim()) continue
                const id = this._encode(batch.source, manga.id)
                if (seen.has(id)) continue
                seen.add(id)
                const synonyms = [manga.title, ...(Array.isArray(manga.synonyms) ? manga.synonyms : [])]
                results.push({
                    ...manga,
                    id,
                    title: `${manga.title} [${batch.source.name}]`,
                    // Keep the original title available for Seanime's automatic matching.
                    synonyms: Array.from(new Set(synonyms.filter(title => typeof title === "string" && title.trim()))),
                })
            }
        }
        return results
    }

    async findChapters(id) {
        const { source, rawId } = this._decode(id)
        const chapters = await this._runSource(source, "findChapters", rawId)
        return chapters.map((chapter, index) => ({ ...chapter, id: this._encode(source, chapter.id), index }))
    }

    async findChapterPages(id) {
        const { source, rawId } = this._decode(id)
        const pages = await this._runSource(source, "findChapterPages", rawId)
        return pages.map((page, index) => ({ ...page, index }))
    }
}
