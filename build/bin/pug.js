// build html
/**
 * build common files with react module in it
 */
const fs = require('fs')
const pug = require('pug')
const { resolve } = require('path')
const pack = require('../../package.json')
const deepCopy = require('json-deep-copy')

const entryPug = resolve(
  __dirname,
  '../../src/client/views/index.pug'
)
const targetFilePath = resolve(
  __dirname,
  '../../work/app/assets/index.html'
)
const pugContent = fs.readFileSync(entryPug, 'utf-8')
const defaultAIPreset = {
  baseURLAI: 'https://ai.electerm.org/api/ai',
  apiPathAI: '/chat/completions',
  modelAI: 'free',
  authHeaderNameAI: 'Authorization: Bearer',
  id: 'ai.electerm.org',
  nameAI: 'ai.electerm.org',
  siteUrl: 'https://ai.electerm.org?utm=electerm'
}

// const AIDisclamer = 'AI-generated terminal commands can be inaccurate or unsafe, be careful'

const data = {
  version: pack.version,
  siteName: pack.name,
  isDev: false,
  defaultAIPreset,
  // The entry bundle statically imports ~190 chunks. index.html is built here
  // rather than by Vite, so Vite's automatic modulepreload injection never ran
  // and the browser only discovers those chunks after the entry bundle has been
  // fetched *and* parsed -- a second waterfall. Emit the hints ourselves so the
  // fetches are queued during HTML parse. Only static imports count: the
  // `__vite__mapDeps` table also lists lazy chunks, which must stay lazy.
  preloadChunks: getEntryChunks()
}

function getEntryChunks () {
  const entry = resolve(
    __dirname,
    `../../work/app/assets/js/electerm-${pack.version}.js`
  )
  try {
    const src = fs.readFileSync(entry, 'utf-8')
    const re = /from"(\.\.\/chunk\/[^"]+\.js)"/g
    const found = new Set()
    let m
    while ((m = re.exec(src))) {
      // the bundle refers to chunks as ../chunk/x.js (relative to js/); the
      // preload href must be relative to index.html instead
      found.add(m[1].replace(/^\.\.\//, ''))
    }
    return [...found]
  } catch (e) {
    // A missing entry bundle just means no preload hints; the app still boots.
    return []
  }
}
const htmlContent = pug.render(pugContent, {
  filename: entryPug,
  ...data,
  _global: deepCopy(data)
})
fs.writeFileSync(targetFilePath, htmlContent, 'utf8')
