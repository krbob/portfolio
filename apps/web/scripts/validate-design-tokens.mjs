/* global URL, console */
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'

const webRoot = new URL('../', import.meta.url)
const contractRoot = new URL('src/styles/vendor/stock-ecosystem-ui/', webRoot)
const sourceRoot = new URL('src/', webRoot)
const [css, manifestSource, sourceLockSource] = await Promise.all([
  readFile(new URL('tokens.css', contractRoot), 'utf8'),
  readFile(new URL('tokens.manifest.json', contractRoot), 'utf8'),
  readFile(new URL('source.json', contractRoot), 'utf8'),
])
const manifest = JSON.parse(manifestSource)
const sourceLock = JSON.parse(sourceLockSource)

function fail(message) {
  throw new Error(`Design-token contract is invalid: ${message}`)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

if (sourceLock.schemaVersion !== 1) fail(`unsupported source lock ${sourceLock.schemaVersion}`)
if (!/^[a-f0-9]{40}$/.test(sourceLock.sourceCommit)) fail('source commit is not a full Git revision')
if (sourceLock.contractVersion !== manifest.version) fail('source lock and manifest versions differ')
for (const [fileName, contents] of Object.entries({
  'tokens.css': css,
  'tokens.manifest.json': manifestSource,
})) {
  const expected = sourceLock.files[fileName]
  const actual = sha256(contents)
  if (actual !== expected) fail(`${fileName} source hash expected ${expected}, received ${actual}`)
}

const digest = sha256(css)
if (digest !== manifest.sha256) fail(`manifest hash expected ${manifest.sha256}, received ${digest}`)
if (!css.includes(`contract — v${manifest.version}`)) fail('CSS version and manifest version differ')
if (manifest.schemaVersion !== 1) fail(`unsupported manifest schema ${manifest.schemaVersion}`)

const declared = new Set([...css.matchAll(/^\s*(--ui-[a-z0-9-]+):/gm)].map((match) => match[1]))
const inventory = Object.values(manifest.layers).flat()
if (new Set(inventory).size !== inventory.length) fail('a token belongs to more than one layer')

const missing = inventory.filter((token) => !declared.has(token))
const unlisted = [...declared].filter((token) => !inventory.includes(token))
if (missing.length > 0) fail(`manifest tokens missing from CSS: ${missing.join(', ')}`)
if (unlisted.length > 0) fail(`CSS tokens missing from manifest: ${unlisted.join(', ')}`)

const publicTokens = new Set(manifest.publicLayers.flatMap((layer) => {
  if (!manifest.layers[layer]) fail(`unknown public layer ${layer}`)
  return manifest.layers[layer]
}))
if ([...publicTokens].some((token) => token.startsWith('--ui-ref-'))) {
  fail('a primitive token is exposed by a public layer')
}
if (/@(theme|utility|plugin|source)\b/.test(css)) fail('framework syntax leaked into vendored tokens.css')

const consumerFiles = await sourceFiles(sourceRoot)
let semanticUsage = 0
let componentUsage = 0
for (const file of consumerFiles) {
  const contents = await readFile(file, 'utf8')
  const tokens = [...contents.matchAll(/--ui-[a-z0-9-]+/g)].map((match) => match[0])
  for (const token of tokens) {
    if (token.startsWith('--ui-ref-')) fail(`private primitive ${token} used by ${file.pathname}`)
    if (!publicTokens.has(token)) fail(`unknown public token ${token} used by ${file.pathname}`)
    if (manifest.layers.semantic.includes(token)) semanticUsage += 1
    if (manifest.layers.component.includes(token)) componentUsage += 1
  }
}
if (semanticUsage === 0 || componentUsage === 0) fail('Portfolio adapter must consume semantic and component layers')

console.log(
  `Design-token contract ${manifest.version} verified ` +
  `(${inventory.length} tokens, ${digest.slice(0, 12)}, source ${sourceLock.sourceCommit.slice(0, 7)}).`,
)

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    if (entry.isDirectory()) {
      if (url.pathname.includes('/styles/vendor/')) continue
      files.push(...await sourceFiles(url))
    } else if (/\.(css|ts|tsx)$/.test(entry.name)) {
      files.push(url)
    }
  }
  return files
}
