const fs = require('fs')
const os = require('os')
const path = require('path')

// Two widgets, installed before the app starts: one that is nothing but a
// stylesheet, one that has only a UI and restyles the app from it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-e2e-widget-css-'))
const write = (id, pkg, files) => {
  const dir = path.join(tmp, 'widgets', id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  Object.entries(files).forEach(([name, content]) => {
    fs.writeFileSync(path.join(dir, name), content)
  })
}
write('probe', {
  name: 'probe',
  version: '1.0.0',
  electerm: {
    id: 'probe',
    name: 'Probe',
    type: 'instance',
    singleInstance: true,
    styles: ['style.css']
  }
}, {
  'style.css': '.probe-marker { color: rgb(4, 5, 6) }'
})
write('uiprobe', {
  name: 'uiprobe',
  version: '1.0.0',
  electerm: { id: 'uiprobe', name: 'UI Probe', ui: 'index.html' }
}, {
  'index.html': `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div id="done">waiting</div>
<script>
  window.electerm.ready.then(function () {
    window.electerm.css.apply('.uiprobe-marker { color: rgb(1, 2, 3) }')
      .then(function (applied) {
        document.getElementById('done').textContent = 'applied:' + applied
      })
  })
</script>
</body></html>`
})
process.env.DATA_PATH = tmp

const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
const assert = require('node:assert/strict')
const delay = require('./common/wait')
const log = require('./common/log')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')
const { describe } = it
it.setTimeout(150000)

const cssTag = (id) => `style[data-electerm-widget="${id}"]`

describe('widget css', function () {
  it('is applied by the host, restored after a reload, and removed on stop', async function () {
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(3500)

    // 1. a manifest-only widget: run it, its stylesheet reaches the document.
    //    store.runWidget makes the renderer re-read the instance list from the
    //    main process, so no copy is assembled here.
    const run = await client.evaluate(async () => {
      const r = await window.store.runWidget('probe', {})
      return {
        ...r,
        listed: window.store.widgetInstances.map(i => i.widgetId)
      }
    })
    log('run', run)
    assert.deepEqual(run.listed, ['probe'])
    await delay(600)
    const applied = await client.evaluate((sel) => {
      const el = document.querySelector(sel)
      return el ? el.textContent : null
    }, cssTag('probe'))
    log('declared css in the document', applied)
    assert.match(String(applied), /probe-marker/)

    // 2. a reloaded renderer learns what the main process is running instead of
    //    starting from an empty list, and the css it gets is derived from the
    //    instance, not stored anywhere
    await client.reload()
    await delay(3500)
    let reloaded = null
    for (let i = 0; i < 40; i++) {
      reloaded = await client.evaluate((sel) => {
        const el = document.querySelector(sel)
        return {
          css: el ? el.textContent : null,
          derived: window.pre.runSync('getWidgetStyles'),
          listed: window.store.widgetInstances.map(i => ({
            id: i.id,
            widgetId: i.widgetId,
            title: i.title,
            config: i.config,
            startedAt: i.startedAt
          }))
        }
      }, cssTag('probe'))
      if (reloaded.listed.length) {
        break
      }
      await delay(250)
    }
    log('after reload', reloaded)
    assert.match(String(reloaded.css), /rgb\(4, 5, 6\)/)
    assert.match(String(reloaded.derived.probe), /probe-marker/)
    assert.equal(reloaded.listed.length, 1)
    assert.equal(reloaded.listed[0].id, run.instanceId)
    assert.equal(reloaded.listed[0].widgetId, 'probe')
    assert.match(reloaded.listed[0].title, /^Probe \(/)
    assert.ok(reloaded.listed[0].startedAt > 0)

    // 3. stop: nothing left behind — not in the document, not in the derived
    //    css, not in the instance list the panel reads
    const afterStop = await client.evaluate(async ({ sel, instanceId }) => {
      await window.store.stopWidget(instanceId)
      await new Promise(resolve => setTimeout(resolve, 500))
      return {
        tag: !!document.querySelector(sel),
        derived: window.pre.runSync('getWidgetStyles'),
        listed: window.store.widgetInstances.length
      }
    }, { sel: cssTag('probe'), instanceId: run.instanceId })
    log('after stop', afterStop)
    assert.equal(afterStop.tag, false)
    assert.equal(!!afterStop.derived.probe, false)
    assert.equal(afterStop.listed, 0)

    // 4. delete an instance — stopping is not the same thing: the widget is
    //    also in the launch list, and a reload starts everything in it, which
    //    is how the deleted row used to come back
    const deleted = await client.evaluate(async () => {
      const r = await window.store.runWidget('probe', {})
      window.store.setWidgetAutoRun('probe', true, {})
      const tagged = window.store.widgetInstances.map(i => !!i.autoRun)
      await window.store.deleteWidgetInstance(r.instanceId)
      return {
        tagged,
        listed: window.store.widgetInstances.length,
        launch: window.store.autoRunWidgets.filter(w => w.widgetId === 'probe').length
      }
    })
    log('after delete', deleted)
    assert.deepEqual(deleted.tagged, [true])
    assert.equal(deleted.listed, 0)
    assert.equal(deleted.launch, 0)

    await client.reload()
    await delay(3500)
    const afterDeleteReload = await client.evaluate((sel) => ({
      tag: !!document.querySelector(sel),
      listed: window.store.widgetInstances.map(i => i.widgetId),
      launch: (window.store.autoRunWidgets || [])
        .filter(w => w.widgetId === 'probe').length
    }), cssTag('probe'))
    log('after delete + reload', afterDeleteReload)
    assert.deepEqual(afterDeleteReload.listed, [])
    assert.equal(afterDeleteReload.tag, false)
    assert.equal(afterDeleteReload.launch, 0)

    // 5. a widget whose UI restyles the app: no node script involved
    const listed = await client.evaluate(async () => {
      const w = (await window.store.listWidgets()).find(x => x.id === 'uiprobe')
      if (!w) {
        return null
      }
      window.store.storeAssign({ settingTab: 'widgets' })
      window.store.setSettingItem(w)
      window.store.openSettingModal()
      return { state: w.state, ui: w.info.ui }
    })
    log('uiprobe', listed)
    assert.equal(listed.state, 'ok')

    let frame = null
    for (let i = 0; i < 40 && !frame; i++) {
      frame = client.frames().find(f => /electerm-widget:\/\/uiprobe\/index\.html/.test(f.url()))
      if (!frame) {
        await delay(250)
      }
    }
    assert.equal(!!frame, true)
    await frame.waitForSelector('#done')
    const said = await frame.textContent('#done')
    log('widget ui says', said)
    assert.match(String(said), /applied:\.uiprobe-marker/)

    const fromUi = await client.evaluate((sel) => {
      const el = document.querySelector(sel)
      return el ? el.textContent : null
    }, cssTag('uiprobe'))
    log('css from the widget UI', fromUi)
    assert.match(String(fromUi), /uiprobe-marker/)

    await frame.evaluate(() => window.electerm.css.remove())
    await delay(600)
    const removed = await client.evaluate(
      (sel) => !!document.querySelector(sel),
      cssTag('uiprobe')
    )
    assert.equal(removed, false)

    await client.evaluate(() => window.store.hideSettingModal())
    await delay(300)
    await electronApp.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  })
})
