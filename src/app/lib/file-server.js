module.exports = (app) => {
  const express = require('express')
  return new Promise((resolve) => {
    const conf = {
      maxAge: 1000 * 60 * 60 * 24 * 365
    }
    app.use(
      express.static(
        require('path').resolve(__dirname, '../assets'),
        conf
      )
    )
  })
}
