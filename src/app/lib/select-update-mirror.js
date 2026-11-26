const axios = require('axios')
const mirrors = require('../common/update-mirrors.json')
const { createProxyAgent } = require('./proxy-agent')

const sampleBytes = 256 * 1024

async function probe (url, agent, signal) {
  const { data, headers, status } = await axios.get(url, {
    responseType: 'stream',
    headers: { Range: 'bytes=0-' + (sampleBytes - 1), 'Accept-Encoding': 'identity' },
    proxy: false,
    httpsAgent: agent,
    signal
  })
  try {
    const range = headers['content-range'] || ''
    if ((status !== 200 && status !== 206) || /html|json|text\//i.test(headers['content-type'] || '') ||
      (status === 206 && !new RegExp('^bytes 0-' + (sampleBytes - 1) + '/[0-9]+$').test(range))) {
      throw new Error('Invalid mirror response')
    }
    let bytes = 0
    for await (const chunk of data) {
      bytes += chunk.length
      if (bytes >= sampleBytes) return
    }
    throw new Error('Incomplete mirror sample')
  } finally {
    data.destroy()
  }
}

async function selectMirror ({ tag, src, proxy, signal }) {
  if (signal.aborted) throw new Error('Update cancelled')
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = setTimeout(abort, 8000)
  signal.addEventListener('abort', abort, { once: true })
  let agent
  try {
    agent = createProxyAgent(proxy)
    const file = encodeURIComponent('electerm-' + tag.slice(1) + '-' + src)
    return await Promise.any(Object.entries(mirrors).map(async ([name, template]) => {
      const url = template.replace('{tag}', encodeURIComponent(tag)).replace('{file}', file)
      await probe(url, agent, controller.signal)
      return name
    }))
  } catch (err) {
    if (signal.aborted) throw new Error('Update cancelled')
    if (!(err instanceof AggregateError)) throw err
    return 'github'
  } finally {
    clearTimeout(timer)
    abort()
    signal.removeEventListener('abort', abort)
    agent?.destroy()
  }
}

module.exports = { selectMirror }
