module.exports = (app) => {
  const express = require('express')
  const path = require('path')

  return new Promise((resolve) => {
    const assetsPath = path.resolve(__dirname, '../assets')
    const oneYearMs = 1000 * 60 * 60 * 24 * 365

    // Handle _temp_*.css files - return empty CSS to prevent MIME type errors
    app.use((req, res, next) => {
      if (req.url.startsWith('/css/_temp_') && req.url.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css')
        res.send('')
        return
      }
      next()
    })

    // Vite chunk filenames include a content hash, so a year-long TTL +
    // immutable is safe — different bytes always produce a different URL.
    app.use('/chunk', express.static(path.join(assetsPath, 'chunk'), {
      maxAge: oneYearMs,
      immutable: true
    }))

    // index.html / js/ / css/ / images/ keep stable filenames per release
    // (no content hash). A long TTL on these pins users to stale bundles
    // after a reinstall when bytes change but the URL does not — disable
    // the HTTP cache (ETag still allows 304 revalidation).
    app.use(express.static(assetsPath, {
      setHeaders (res) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    }))
  })
}
