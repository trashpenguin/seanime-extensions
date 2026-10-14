// Bundled with the six source adapters by scripts/build-collection.js.
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
        let requestError
        // Bind each adapter to a checked fetch. This also captures request failures
        // in older adapters that catch exceptions and return an empty list.
        const adapter = source.create(async (url, options) => {
            try {
                const response = await fetch(url, { ...options, timeout: 15 })
                if (!response.ok) throw new Error(`request failed (HTTP ${response.status})`)
                const read = async method => {
                    try {
                        return await response[method]()
                    } catch (error) {
                        requestError = error
                        throw error
                    }
                }
                return {
                    ...response,
                    ok: response.ok,
                    status: response.status,
                    url: response.url,
                    json: () => read("json"),
                    text: () => read("text"),
                }
            } catch (error) {
                requestError = error
                throw error
            }
        })
        try {
            const results = await adapter[method](value)
            if (requestError) throw requestError
            if (!Array.isArray(results)) throw new Error("returned an invalid result list")
            return results
        } catch (error) {
            throw new Error(`${source.name}: ${error && error.message ? error.message : String(error)}`)
        }
    }

    async search(opts) {
        const query = opts && typeof opts.query === "string" ? opts.query.trim() : ""
        if (!query) return []
        const batches = await Promise.all(COLLECTION_SOURCES.map(async source => {
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
