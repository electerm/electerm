#!/usr/bin/env node

const fs = require('fs/promises')
const path = require('path')

const BASE_URL = 'https://electerm.html5beta.com'

function buildRedirectUrl (filename) {
  return filename === 'index.html' ? BASE_URL : `${BASE_URL}/${filename}`
}

function insertAfterTitle (html, metaTag) {
  // Remove any existing refresh meta tags to avoid duplicates
  const cleaned = html.replace(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*>\s*/ig, '')

  const titleCloseRe = /<\/title\s*>/i
  if (titleCloseRe.test(cleaned)) {
    return cleaned.replace(titleCloseRe, m => `${m}\n    ${metaTag}`)
  }

  const headOpenRe = /<head[^>]*>/i
  if (headOpenRe.test(cleaned)) {
    return cleaned.replace(headOpenRe, m => `${m}\n    ${metaTag}`)
  }

  // Fallback: prepend if neither <title> nor <head> exists
  return `${metaTag}\n${cleaned}`
}

async function getTargetFiles (rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  return entries
    .filter(e => e.isFile())
    .map(e => e.name)
    .filter(name => (
      (name.startsWith('index') && name.endsWith('.html')) ||
      name === 'sponsor-electerm.html'
    ))
    .sort()
}

async function processFile (rootDir, filename) {
  const filePath = path.join(rootDir, filename)
  const original = await fs.readFile(filePath, 'utf8')

  const url = buildRedirectUrl(filename)
  const metaTag = `<meta http-equiv="refresh" content="0; url=${url}">`

  if (original.includes(metaTag)) {
    return { filename, updated: false, url, reason: 'already-correct' }
  }

  const updated = insertAfterTitle(original, metaTag)

  if (updated !== original) {
    await fs.writeFile(filePath, updated, 'utf8')
    return { filename, updated: true, url }
  }

  // Safety: ensure it's present
  if (!/http-equiv=["']?refresh["']?/i.test(updated)) {
    await fs.writeFile(filePath, `${metaTag}\n${updated}`, 'utf8')
    return { filename, updated: true, url, reason: 'prepended-fallback' }
  }

  return { filename, updated: false, url, reason: 'no-change' }
}

; (async function main () {
  try {
    const rootDir = process.cwd()
    const files = await getTargetFiles(rootDir)

    if (!files.length) {
      console.error('No matching files found (index*.html, sponsor-electerm.html).')
      process.exit(1)
    }

    const results = await Promise.all(files.map(f => processFile(rootDir, f)))
    const changed = results.filter(r => r.updated)

    console.log(`Processed ${results.length} files. Updated ${changed.length}.`)
    changed.forEach(r => console.log(`- ${r.filename} -> ${r.url}`))
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
