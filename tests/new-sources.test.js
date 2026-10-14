const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function load(name, responses = []) {
    const file = path.join(__dirname, '..', name, 'provider.js')
    assert.ok(fs.existsSync(file), `${name} provider must exist`)
    const calls = []
    const fetch = async (url, options) => {
        calls.push({ url, options })
        assert.ok(responses.length, 'Unexpected request')
        const fixture = responses.shift()
        return {
            ok: fixture.status ? fixture.status < 400 : true,
            status: fixture.status || 200,
            url: fixture.url || url,
            text: async () => fixture.body,
            json: async () => fixture.body,
        }
    }
    const provider = vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\nnew Provider()', { fetch })
    return { provider, calls }
}

for (const name of ['mangakatana', 'atsumaru']) {
    test(`${name}: blank queries make no network requests`, async () => {
        const { provider, calls } = load(name)
        for (const options of [undefined, {}, { query: '' }, { query: '  ' }]) {
            assert.equal((await provider.search(options)).length, 0)
        }
        assert.equal(calls.length, 0)
    })

    test(`${name}: HTTP failures remain visible`, async () => {
        const { provider } = load(name, [{ status: 429 }, { status: 503 }, { status: 403 }])
        await assert.rejects(provider.search({ query: 'test' }), /HTTP 429/)
        await assert.rejects(provider.findChapters('series.1'), /HTTP 503/)
        await assert.rejects(provider.findChapterPages(name === 'atsumaru' ? 'series.1|chapter' : 'series.1/c1'), /HTTP 403/)
    })
}

const card = (id, title, image) => `<div data-id='1' class='item'>
    <div class='media'><a href='/manga/${id}'><picture><img alt='[Cover]' data-src='${image}'></picture></a></div>
    <div class='text'><h3 class='title'><a target='_blank' href='/manga/${id}'>${title}</a><span> - 2 chapters</span></h3></div>
</div>`

test('MangaKatana: parses result cards, entities and lazy covers without duplicates', async () => {
    const { provider, calls } = load('mangakatana', [{ body:
        card('alpha.1', 'A &amp; B &#x1F600;', '//cdn.example.com/alpha.jpg') +
        card('alpha.1', 'Duplicate', '/duplicate.jpg') +
        card('beta.2', 'Beta', '/cover.jpg')
    }])
    const results = await provider.search({ query: ' A & B ' })
    assert.equal(results.length, 2)
    assert.equal(results[0].id, 'alpha.1')
    assert.equal(results[0].title, 'A & B 😀')
    assert.equal(results[0].image, 'https://cdn.example.com/alpha.jpg')
    assert.equal(results[1].image, 'https://mangakatana.com/cover.jpg')
    assert.ok(calls[0].url.includes('search=A%20%26%20B'))
})

test('MangaKatana: a single-result redirect returns the manga itself', async () => {
    const { provider } = load('mangakatana', [{ url: 'https://mangakatana.com/manga/alpha.1', body:
        `<meta content='Alpha &amp; Omega' property='og:title'>
         <meta content='/cover.jpg' property='og:image'>${card('other.2', 'Related series', '/other.jpg')}`
    }])
    const results = await provider.search({ query: 'alpha' })
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 'alpha.1')
    assert.equal(results[0].title, 'Alpha & Omega')
})

test('MangaKatana: chapters are numerically sorted and belong only to the requested manga', async () => {
    const { provider } = load('mangakatana', [{ body:
        `<a href='/manga/other.2/c1'>Chapter 1: Related manga</a>
         <a href='https://mangakatana.com/manga/alpha.1/c10'>Chapter 10: Finale</a>
         <a href='/manga/alpha.1/c2.5'>Chapter 2.5: A &amp; B</a>
         <a href='/manga/alpha.1/c2'>Chapter 2</a>
         <a href='/manga/alpha.1/c2'>Duplicate</a>`
    }])
    const chapters = await provider.findChapters('alpha.1')
    assert.equal(JSON.stringify(chapters.map(ch => [ch.id, ch.chapter, ch.index])), JSON.stringify([
        ['alpha.1/c2', '2', 0], ['alpha.1/c2.5', '2.5', 1], ['alpha.1/c10', '10', 2]
    ]))
    assert.equal(chapters[1].title, 'Chapter 2.5: A & B')
})

test('MangaKatana: extracts the reader array without executing scripts or scraping ads', async () => {
    const { provider } = load('mangakatana', [{ body:
        `<img src='https://example.com/ad.jpg'>
         <script>throw new Error('never execute'); var thzq = ['https:\\/\\/cdn.example.com/1.jpg', "https://cdn.example.com/2.jpg", 'https://cdn.example.com/1.jpg',];</script>`
    }])
    const pages = await provider.findChapterPages('alpha.1/c2')
    assert.equal(pages.length, 2)
    assert.equal(pages[0].url, 'https://cdn.example.com/1.jpg')
    assert.equal(pages[1].index, 1)
    assert.equal(pages[0].headers.Referer, 'https://mangakatana.com/')
})

test('MangaKatana: an empty search is valid, but missing chapters or reader data is an error', async () => {
    const { provider } = load('mangakatana', [{ body: '<p>No results</p>' }, { body: '<p>Changed layout</p>' }, { body: '<script>var thzq = [];</script>' }])
    assert.equal((await provider.search({ query: 'unknown' })).length, 0)
    await assert.rejects(provider.findChapters('alpha.1'), /chapter/i)
    await assert.rejects(provider.findChapterPages('alpha.1/c1'), /page|reader/i)
})

test('MangaKatana: rejects invalid IDs before making requests', async () => {
    const { provider, calls } = load('mangakatana')
    await assert.rejects(provider.findChapters('../other'), /invalid/i)
    await assert.rejects(provider.findChapterPages('https://example.com/private'), /invalid/i)
    assert.equal(calls.length, 0)
})

test('Atsumaru: maps valid search documents with covers and synonyms', async () => {
    const { provider, calls } = load('atsumaru', [{ body: { hits: [
        { document: { id: 'alpha', title: 'Alpha', englishTitle: 'English title', posterMedium: '/cover.avif', otherNames: ['Alternate'], releaseYear: 2021 } },
        { document: { id: 'beta', title: 'Beta', poster: 'https://cdn.example.com/beta.jpg' } },
        { document: { id: 'alpha', title: 'Duplicate' } }, {}, { document: { title: 'Missing ID' } }
    ] } }])
    const results = await provider.search({ query: ' A & B ' })
    assert.equal(results.length, 2)
    assert.equal(results[0].id, 'alpha')
    assert.equal(results[0].image, 'https://cdn.atsu.moe/cover.avif')
    assert.equal(results[0].synonyms.includes('Alternate'), true)
    assert.equal(results[0].synonyms.includes('English title'), true)
    assert.equal(results[0].year, 2021)
    assert.equal(results[1].image, 'https://cdn.example.com/beta.jpg')
    assert.ok(calls[0].url.includes('q=A%20%26%20B'))
})

test('Atsumaru: sorts decimal and zero chapters and preserves distinct IDs', async () => {
    const { provider } = load('atsumaru', [{ body: { chapters: [
        { id: 'ten', number: 10 }, { id: 'half', number: 1.5, title: 'Extra' },
        { id: 'zero', number: 0 }, { id: 'ten', number: 10 }, { id: 'alternate', number: 1.5 }, { number: 3 }
    ] } }])
    const chapters = await provider.findChapters('alpha')
    assert.equal(JSON.stringify(chapters.map(ch => [ch.id, ch.chapter, ch.index])), JSON.stringify([
        ['alpha|zero', '0', 0], ['alpha|half', '1.5', 1], ['alpha|alternate', '1.5', 2], ['alpha|ten', '10', 3]
    ]))
    assert.equal(chapters[1].title, 'Extra')
    assert.equal(chapters[0].url, 'https://atsu.moe/read/alpha/zero')
})

test('Atsumaru: restores composite IDs and returns pages in numeric reading order', async () => {
    const { provider, calls } = load('atsumaru', [{ body: { readChapter: { pages: [
        { number: 2, image: '/2.webp' }, { number: 0, image: '//cdn.example.com/0.webp' },
        { number: 1, image: 'https://cdn.example.com/1.webp' }, { number: 2, image: '/2.webp' }, { number: 3 }
    ] } } }])
    const pages = await provider.findChapterPages('alpha|half')
    assert.equal(JSON.stringify(pages.map(page => [page.url, page.index])), JSON.stringify([
        ['https://cdn.example.com/0.webp', 0], ['https://cdn.example.com/1.webp', 1], ['https://cdn.atsu.moe/2.webp', 2]
    ]))
    assert.ok(calls[0].url.includes('mangaId=alpha&chapterId=half'))
    assert.equal(pages[0].headers.Referer, 'https://atsu.moe/read/alpha/half')
})

test('Atsumaru: invalid payloads fail visibly while valid empty lists are allowed', async () => {
    const { provider } = load('atsumaru', [
        { body: {} }, { body: { hits: [] } }, { body: {} }, { body: { chapters: [] } }, { body: { readChapter: { pages: [] } } }
    ])
    await assert.rejects(provider.search({ query: 'test' }), /invalid/i)
    assert.equal((await provider.search({ query: 'test' })).length, 0)
    await assert.rejects(provider.findChapters('alpha'), /invalid/i)
    assert.equal((await provider.findChapters('alpha')).length, 0)
    await assert.rejects(provider.findChapterPages('alpha|half'), /page/i)
})

test('Atsumaru: malformed composite IDs make no requests', async () => {
    const { provider, calls } = load('atsumaru')
    for (const id of ['missing-separator', '|half', 'alpha|', 'alpha|half|extra']) {
        await assert.rejects(provider.findChapterPages(id), /invalid/i)
    }
    assert.equal(calls.length, 0)
})
