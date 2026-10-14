const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.join(__dirname, '..')
const providers = ['mangadex', 'comick', 'weebcentral', 'mangapill']
function loadProvider(name, fetch) {
    const source = fs.readFileSync(path.join(root, name, 'provider.js'), 'utf8')
    return vm.runInNewContext(source + '\nnew Provider()', { fetch })
}
function fixtureProvider(responses) {
    const calls = []
    const provider = loadProvider('mangadex', async url => {
        calls.push(url)
        assert.ok(responses.length, 'Unexpected extra request')
        const response = responses.shift()
        return { ok: true, status: 200, json: async () => response }
    })
    return { provider, calls }
}
function chapter(id, number, externalUrl) {
    return { id, attributes: { chapter: number, translatedLanguage: 'en', externalUrl } }
}

for (const name of providers) {
    test(`${name}: manifest and standalone provider contract`, () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, name, 'manifest.json'), 'utf8'))
        assert.equal(manifest.id, name)
        assert.equal(manifest.type, 'manga-provider')
        assert.match(manifest.version, /^\d+\.\d+\.\d+$/)
        for (const [field, file] of [['payloadURI', 'provider.js'], ['manifestURI', 'manifest.json']]) {
            assert.equal(manifest[field], `https://raw.githubusercontent.com/trashpenguin/seanime-extensions/main/${name}/${file}`)
        }
        const provider = loadProvider(name, () => { throw new Error('Unexpected request') })
        for (const method of ['getSettings', 'search', 'findChapters', 'findChapterPages']) {
            assert.equal(typeof provider[method], 'function')
        }
        assert.equal(typeof provider.getSettings().supportsMultiLanguage, 'boolean')
    })
}

test('MangaDex: blank searches make no requests', async () => {
    const { provider, calls } = fixtureProvider([])
    for (const opts of [undefined, {}, { query: '  ' }, { query: 1 }]) {
        assert.equal((await provider.search(opts)).length, 0)
    }
    assert.equal(calls.length, 0)
    assert.equal(provider.getSettings().supportsMultiLanguage, false)
})

test('MangaDex: search encodes the query and preserves cover and alternate titles', async () => {
    const { provider, calls } = fixtureProvider([{ data: [{
        id: 'manga', attributes: { title: { en: 'A & B' }, altTitles: [{ ja: 'Alternate' }], year: 2020 },
        relationships: [{ type: 'cover_art', attributes: { fileName: 'cover.png' } }]
    }] }])
    const results = await provider.search({ query: ' A & B ' })
    assert.ok(calls[0].includes('title=A%20%26%20B'))
    assert.equal(results[0].title, 'A & B')
    assert.equal(results[0].synonyms[0], 'Alternate')
    assert.equal(results[0].image, 'https://uploads.mangadex.org/covers/manga/cover.png.256.jpg')
})

test('MangaDex: paginates raw records, deduplicates IDs, skips external chapters and assigns consecutive indices', async () => {
    const { provider, calls } = fixtureProvider([
        { data: [chapter('one', '1'), chapter('external', '2', 'https://example.com/chapter')], total: 4 },
        { data: [chapter('one', '1'), chapter('three', '3')], total: 4 }
    ])
    const chapters = await provider.findChapters('manga')
    assert.equal(JSON.stringify(chapters.map(ch => [ch.id, ch.chapter, ch.index])), JSON.stringify([['one', '1', 0], ['three', '3', 1]]))
    assert.ok(calls[1].includes('offset=2'))
})

test('MangaDex: continues to an empty page when total is missing', async () => {
    const { provider, calls } = fixtureProvider([{ data: [chapter('one', '1')] }, { data: [] }])
    assert.equal((await provider.findChapters('manga')).length, 1)
    assert.equal(calls.length, 2)
})

test('MangaDex: an external-only page does not hide later hosted chapters', async () => {
    const { provider } = fixtureProvider([
        { data: [chapter('external', '1', 'https://example.com/chapter')], total: 2 },
        { data: [chapter('hosted', '2')], total: 2 }
    ])
    const chapters = await provider.findChapters('manga')
    assert.equal(chapters.length, 1)
    assert.equal(chapters[0].id, 'hosted')
    assert.equal(chapters[0].index, 0)
})

test('MangaDex: repeated pages fail instead of looping or returning an incomplete list', async () => {
    const { provider } = fixtureProvider([{ data: [chapter('one', '1')] }, { data: [chapter('one', '1')] }])
    await assert.rejects(provider.findChapters('manga'), /pagination made no progress/)
})

test('MangaDex: builds ordered at-home page URLs', async () => {
    const { provider } = fixtureProvider([{ baseUrl: 'https://cdn.example.com', chapter: { hash: 'hash', data: ['a.jpg', 'b.jpg'] } }])
    const pages = await provider.findChapterPages('one')
    assert.equal(pages[0].url, 'https://cdn.example.com/data/hash/a.jpg')
    assert.equal(pages[1].index, 1)
})

test('MangaDex: HTTP errors are visible for every operation', async () => {
    const provider = loadProvider('mangadex', async () => ({ ok: false, status: 429, json: () => { throw new Error('Must not parse error body') } }))
    await assert.rejects(provider.search({ query: 'test' }), /HTTP 429/)
    await assert.rejects(provider.findChapters('manga'), /HTTP 429/)
    await assert.rejects(provider.findChapterPages('one'), /HTTP 429/)
})

test('MangaDex: API errors and malformed payloads are visible', async () => {
    for (const response of [null, { result: 'error' }, {}]) {
        const { provider } = fixtureProvider([response])
        await assert.rejects(provider.search({ query: 'test' }), /MangaDex/)
    }
    const { provider } = fixtureProvider([{ data: {} }, { baseUrl: 'https://cdn.example.com', chapter: { hash: 'hash' } }])
    await assert.rejects(provider.findChapters('manga'), /invalid chapter list/)
    await assert.rejects(provider.findChapterPages('one'), /invalid chapter page data/)
})

test('MangaDex: a later page failure rejects the entire chapter request', async () => {
    const { provider } = fixtureProvider([{ data: [chapter('one', '1')], total: 2 }, { result: 'error' }])
    await assert.rejects(provider.findChapters('manga'), /unsuccessful response/)
})
