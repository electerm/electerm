const { prepare } = require('@electerm/updater')
const { download, format } = require('@electerm/updater/release')

process.once('message', async ({ options, dir }) => {
  const controller = new AbortController()
  options.signal = controller.signal
  process.on('message', m => {
    if (m.cancel) controller.abort()
  })
  const progress = percent => process.send({ percent })
  try {
    await require('./windows-intermediates')()
    if (options.mirror === 'auto') {
      format(options.src, process.platform)
      process.send({ probing: true })
      options.mirror = await require('./select-update-mirror').selectMirror(options)
      process.send({ mirror: options.mirror })
    }
    let plan
    if (options.downloadOnly) {
      format(options.src, process.platform)
      await download(options, dir, progress)
      plan = {}
    } else {
      plan = await prepare(options, dir, progress, () => process.send({ preparing: true }))
    }
    process.send({ plan }, () => process.disconnect())
  } catch (err) {
    process.send({ error: err.message }, () => process.disconnect())
  }
})
