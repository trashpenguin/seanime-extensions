const fs = require('node:fs')
const path = require('node:path')

const [tag, revision, directory] = process.argv.slice(2)
if (!/^v\d+\.\d+\.\d+$/.test(tag) || !/^[a-f0-9]{40}$/.test(revision) || !directory) {
    throw new Error('Usage: node scripts/package-release.js <release tag> <commit SHA> <output directory>')
}

const root = path.join(__dirname, '..')
const sources = JSON.parse(fs.readFileSync(path.join(root, 'collection', 'sources.json'), 'utf8'))
const output = path.resolve(directory)
const repository = 'trashpenguin/seanime-extensions'
fs.mkdirSync(output, { recursive: true })

for (const id of ['collection', ...sources]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, id, 'manifest.json'), 'utf8'))
    const raw = `https://raw.githubusercontent.com/${repository}/${revision}/${id}`
    const filename = `${id}-manifest.json`
    manifest.manifestURI = `https://github.com/${repository}/releases/download/${tag}/${filename}`
    manifest.payloadURI = `${raw}/provider.js`
    manifest.readme = `https://github.com/${repository}/blob/${revision}/README.md`
    fs.writeFileSync(path.join(output, filename), JSON.stringify(manifest, null, 2) + '\n')
}
