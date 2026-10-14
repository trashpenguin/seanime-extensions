const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function load(handler) {
    const file = path.join(__dirname, '..', 'collection', 'provider.js')
    assert.ok(fs.existsSync(file), 'The installable collection bundle must exist')
    const calls = []
    const warnings = []
    const provider = vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\nnew Provider()', {
        fetch: async (url, options) => {
            calls.push({ url, options })
            return handler(url, options)
        },
        console: { warn: message => warnings.push(message), error: message => warnings.push(message), log: () => {} },
    })
    return { provider, calls, warnings }
}

function response(data = {}, body = '', status = 200) {
    return { ok: status < 400, status, json: async () => data, text: async () => body }
}

function emptyResponse(url) {
    if (url.includes('api.mangadex.org')) return response({ data: [] })
    if (url.includes('api.comick.io')) return response([])
    if (url.includes('atsu.moe')) return response({ hits: [] })
    return response()
}

test('Collection: blank searches do not contact any sources', async () => {
    const { provider, calls } = load(() => { throw new Error('No request expected') })
    assert.equal((await provider.search({ query: '   ' })).length, 0)
    assert.equal((await provider.search()).length, 0)
    assert.equal(calls.length, 0)
})

test('Collection: searches all six sources concurrently with source-labelled unique IDs', async () => {
    let release
    const gate = new Promise(resolve => { release = resolve })
    const { provider, calls } = load(async url => {
        if (calls.length === 6) release()
        await gate
        if (url.includes('api.mangadex.org')) return response({ data: [{ id: 'same', attributes: { title: { en: 'Example' } }, relationships: [] }] })
        if (url.includes('api.comick.io')) return response([{ slug: 'same', title: 'Example' }, { slug: 'same', title: 'Duplicate' }])
        return emptyResponse(url)
    })
    const results = await provider.search({ query: 'Example' })
    assert.equal(calls.length, 6)
    assert.equal(results.length, 2)
    assert.equal(results[0].title, 'Example [MangaDex]')
    assert.equal(results[1].title, 'Example [ComicK]')
    assert.notEqual(results[0].id, results[1].id)
    assert.equal(results[0].synonyms.includes('Example'), true)
    assert.ok(calls.every(call => call.options.timeout > 0))
})

test('Collection: one failed source does not discard successful results', async () => {
    const { provider, warnings } = load(url => {
        if (url.includes('api.mangadex.org')) return response({}, '', 429)
        if (url.includes('atsu.moe')) return response({ hits: [{ document: { id: 'alpha', title: 'Example' } }] })
        return emptyResponse(url)
    })
    const results = await provider.search({ query: 'Example' })
    assert.equal(results.length, 1)
    assert.equal(results[0].title, 'Example [Atsumaru]')
    assert.ok(warnings.some(message => /MangaDex.*429/.test(message)))
})

test('Collection: network errors swallowed by an individual adapter still remain visible', async () => {
    const { provider } = load(() => { throw new Error('connection failed') })
    await assert.rejects(provider.search({ query: 'Example' }), /all.*sources.*failed/i)
})

test('Collection: valid empty searches remain empty', async () => {
    const { provider } = load(emptyResponse)
    assert.equal((await provider.search({ query: 'no such manga' })).length, 0)
})

test('Collection: selected manga routes chapter and page requests only to its source', async () => {
    const { provider, calls } = load(url => {
        if (url.includes('/documents/search')) return response({ hits: [{ document: { id: 'manga', title: 'Example' } }] })
        if (url.includes('/allChapters')) return response({ chapters: [{ id: 'chapter', number: 1 }] })
        if (url.includes('/read/chapter')) return response({ readChapter: { pages: [{ number: 1, image: '/1.webp' }] } })
        return emptyResponse(url)
    })
    const [manga] = await provider.search({ query: 'Example' })
    calls.length = 0
    const chapters = await provider.findChapters(manga.id)
    const pages = await provider.findChapterPages(chapters[0].id)
    assert.equal(calls.length, 2)
    assert.ok(calls.every(call => call.url.startsWith('https://atsu.moe/')))
    assert.equal(chapters[0].index, 0)
    assert.equal(chapters[0].url, 'https://atsu.moe/read/manga/chapter')
    assert.equal(pages[0].url, 'https://cdn.atsu.moe/1.webp')
    assert.equal(pages[0].headers.Referer, 'https://atsu.moe/read/manga/chapter')
})

test('Collection: URLs and delimiter characters round-trip through opaque chapter IDs', async () => {
    const chapterURL = 'https://mangapill.com/chapters/123-10001000/example-chapter-1?test=one%20two'
    const { provider, calls } = load(url => {
        if (url.includes('/search?')) return response({}, `<a href='/manga/123/example'><img data-src='/cover.jpg'><div class='font-black line-clamp-1'>Example</div></a>`.replace(/'/g, '"'))
        if (url.includes('/manga/123/example')) return response({}, `<a href="/chapters/123-10001000/example-chapter-1?test=one%20two">Chapter 1</a>`)
        if (url === chapterURL) return response({}, '<img src="https://cdn.example.com/page.jpg">')
        return emptyResponse(url)
    })
    const results = await provider.search({ query: 'Example' })
    const manga = results.find(result => result.title === 'Example [MangaPill]')
    assert.ok(manga)
    const chapters = await provider.findChapters(manga.id)
    const pages = await provider.findChapterPages(chapters[0].id)
    assert.equal(calls[calls.length - 1].url, chapterURL)
    assert.equal(pages[0].headers.Referer, 'https://mangapill.com/')
})

test('Collection: unknown sources and malformed IDs fail before contacting sources', async () => {
    const { provider, calls } = load(() => { throw new Error('No request expected') })
    for (const id of [undefined, '', 'unknown:123', 'mangadex:', 'mangadex:%ZZ', 'missing-source']) {
        await assert.rejects(provider.findChapters(id), /invalid|unknown/i)
        await assert.rejects(provider.findChapterPages(id), /invalid|unknown/i)
    }
    assert.equal(calls.length, 0)
})

test('Collection: selected-source HTTP failures do not become empty chapter or page lists', async () => {
    const { provider } = load(() => response({}, '', 503))
    await assert.rejects(provider.findChapters('comick:series'), /ComicK.*503/)
    await assert.rejects(provider.findChapterPages('mangapill:' + encodeURIComponent('https://mangapill.com/chapters/123/chapter-1')), /MangaPill.*503/)
})

test('Collection: malformed JSON is not hidden by an individual adapter', async () => {
    const { provider } = load(() => ({
        ok: true, status: 200,
        json: async () => { throw new SyntaxError('Invalid JSON response') },
    }))
    await assert.rejects(provider.findChapters('comick:series'), /ComicK.*Invalid JSON/)
})
