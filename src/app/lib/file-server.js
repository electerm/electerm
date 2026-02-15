module.exports = (app) => {
  const express = require('express')
  const path = require('path')

  return new Promise((resolve) => {
    const assetsPath = path.resolve(__dirname, '../assets')
    const conf = {
      maxAge: 1000 * 60 * 60 * 24 * 365
    }

    // Handle _temp_*.css files - return empty CSS to prevent MIME type errors
    app.use((req, res, next) => {
      if (req.url.startsWith('/css/_temp_') && req.url.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css')
        res.send('')
        return
      }
      next()
    })

    app.use(
      express.static(assetsPath, conf)
    )
  })
}
