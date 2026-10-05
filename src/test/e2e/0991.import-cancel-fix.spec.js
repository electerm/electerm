/*
 * End-to-end verification of the fix for the cancelled-import wipe.
 *
 * 099.db-corruption.spec.js re-enacts the importAll sequence by hand at the
 * store level (setItems([]) -> stop() -> start()), which documents the
 * mechanism but does not execute store.importAll / runImportTask. So it keeps
 * failing after those are fixed, and it cannot tell whether a fix works.
 *
 * This spec drives the real entry point instead:
 *
 *   store.importAll({ fileContent })   sync.js
 *     -> runImportTask({ stopWatchers, steps, onAbort })   common/import-task.js
 *       -> clear (inside steps, watchers stopped)
 *       -> chunked push
 *       -> abort  -> onAbort rolls the store back -> reseed -> start()
 *
 * and cancels it through the real UI (the progress modal's cancel button,
 * import-progress.jsx -> cancelImportTask()).
 *
 * Expected after the fix: the original bookmarks survive on disk, and the
 * half-imported payload does not.
 * Before the fix: the store is cleared, the watcher restarts, the diff
 * classifies every original record as `removed`, and the whole table is
 * deleted (and replaced by however much of the payload had landed).
 *
 * Run (common/app-options.js hands each run a fresh Electron userData; see the
 * note there for why a shared one silently re-runs an older bundle):
 *   rm -rf /tmp/dbimport && mkdir -p /tmp/dbimport/{data,tmp}
 *   DATA_PATH=/tmp/dbimport/data TMPDIR=/tmp/dbimport/tmp \
 *     ELECTERM_E2E_NO_SANDBOX=1 \
 *     npx playwright test src/test/e2e/0991.import-cancel-fix.spec.js --workers=1
 *
 * ELECTERM_E2E_NO_SANDBOX=1 is only for environments where Electron's sandbox
 * can not initialize; drop it elsewhere.
 */

const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
const { describe } = it
it.setTimeout(240000)
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

// Enough items that the chunked import takes long enough to cancel mid-way
// (batch is 200 in importAll, so this is ~25 batches).
const IMPORT_SIZE = 5000

async function readIds (client) {
  return client.evaluate(async () => {
    const res = await window.pre.runGlobalAsync('dbAction', 'bookmarks', 'find', {})
    return (res || []).map(d => d.id || d._id)
  })
}

async function clean (client, ids) {
  await client.evaluate(async all => {
    for (const id of all) {
      await window.pre.runGlobalAsync('dbAction', 'bookmarks', 'remove', { _id: id })
    }
  }, ids)
  await delay(400)
}

async function seed (client, ids) {
  await clean(client, ids)
  await client.evaluate(all => {
    window.store.bookmarks.push(...all.map((id, i) => ({
      id,
      title: 'bk-' + i,
      host: '10.0.0.' + (i + 1),
      username: 'root',
      group: 'g'
    })))
  }, ids)
  await delay(3000)
}

describe('importAll does not wipe the table on abort (fix verification)', function () {
  it('a cancelled real importAll keeps every bookmark on disk', async function () {
    const ids = ['zz-fix1', 'zz-fix2', 'zz-fix3', 'zz-fix4', 'zz-fix5']
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5000)

    await seed(client, ids)
    const before = await readIds(client)
    console.log(`[fix] seeded: ${ids.filter(i => before.includes(i)).length}/${ids.length} on disk, table total ${before.length}`)
    expect(ids.filter(i => before.includes(i)).length).equal(5)

    // Probe: is the running bundle the one with the abort handling?
    //
    // Only `reseed` is checkable this way: watch.js assigns it straight onto
    // the autoRun function, whereas store methods go through manate's manage(),
    // so store.importAll.toString() returns manate's action wrapper
    // ("function(...e){return a(()=>i.value.apply(this,e))[0]}") and can never
    // show the original body. reseed() is added by the same change, so its
    // presence is the signal that the renderer is running the fixed build.
    const probe = await client.evaluate(() => ({
      href: window.location.href,
      hasReseed: typeof window.watchbookmarks?.reseed
    }))
    console.log(`[fix] probe: ${JSON.stringify(probe)}`)
    // Without this, a stale cached bundle turns the run into a silent test of
    // the old code (which is exactly how this bug hid).
    expect(probe.hasReseed).equal('function')

    // Count reseed() calls: import-task.js calls it on the abort path only.
    await client.evaluate(() => {
      window.__reseedCalls = 0
      for (const w of [window.watchbookmarks, window.watchbookmarkGroups]) {
        if (w && typeof w.reseed === 'function') {
          const orig = w.reseed
          w.reseed = () => { window.__reseedCalls++; return orig() }
        }
      }
    })

    // Kick off a real importAll and leave it running.
    await client.evaluate(n => {
      const payload = {
        bookmarks: Array.from({ length: n }, (_, i) => ({
          id: 'zz-imp-' + i,
          title: 'imported-' + i,
          host: '192.168.1.' + (i % 250 + 1),
          username: 'root',
          group: 'g'
        })),
        config: {}
      }
      window.__importDone = null
      window.__importDone = window.store
        .importAll({ fileContent: JSON.stringify(payload) })
        .then(r => ({ r }))
        .catch(e => ({ err: String((e && e.message) || e) }))
      return true
    }, IMPORT_SIZE)

    // Cancel through the real UI: the progress modal's cancel button calls
    // cancelImportTask(), which flips runImportTask's controller.cancelled.
    await client.locator('.custom-modal-cancel-btn').click({ timeout: 15000 })
    console.log('[fix] clicked cancel')

    const outcome = await client.evaluate(async () => {
      const r = await window.__importDone
      return {
        ...r,
        storeCount: window.store.bookmarks.length,
        storeHasOurs: window.store.bookmarks.filter(d => String(d.id).startsWith('zz-fix')).length,
        reseedCalls: window.__reseedCalls
      }
    })
    console.log(`[fix] importAll settled: ${JSON.stringify(outcome)}`)

    await delay(4000)

    const after = await readIds(client)
    const lost = ids.filter(i => !after.includes(i))
    const imported = after.filter(i => String(i).startsWith('zz-imp-')).length
    console.log(`[fix] after: table total ${after.length} (was ${before.length})`)
    console.log(`[fix] LOST ours: ${lost.length} ${JSON.stringify(lost)}`)
    console.log(`[fix] imported rows on disk: ${imported} of ${IMPORT_SIZE}`)
    console.log(`[fix] store after settle: ${outcome.storeCount} (ours: ${outcome.storeHasOurs})`)

    await electronApp.close()

    // The whole point: nothing of ours may be gone.
    expect(lost.length).equal(0)
    // And the half-finished import must not have replaced the table.
    expect(imported).lessThan(IMPORT_SIZE)
  })

  // The counterweight to the test above. The fix moved the "clear the store"
  // step from before runImportTask to inside it, which is the one change that
  // could quietly break importing for everyone: if the clear never ran, or ran
  // against the wrong name, an import would append to the existing bookmarks
  // instead of replacing them. So assert the success path still replaces.
  it('a completed real importAll still replaces the table', async function () {
    const ids = ['zz-ok1', 'zz-ok2', 'zz-ok3']
    const size = 600
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5000)

    await seed(client, ids)
    const before = await readIds(client)
    expect(ids.filter(i => before.includes(i)).length).equal(3)

    // reseed() must only run on the abort path
    await client.evaluate(() => {
      window.__reseedCalls = 0
      for (const w of [window.watchbookmarks, window.watchbookmarkGroups]) {
        if (w && typeof w.reseed === 'function') {
          const orig = w.reseed
          w.reseed = () => { window.__reseedCalls++; return orig() }
        }
      }
    })

    const outcome = await client.evaluate(async n => {
      const payload = {
        bookmarks: Array.from({ length: n }, (_, i) => ({
          id: 'zz-new-' + i,
          title: 'imported-' + i,
          host: '192.168.2.' + (i % 250 + 1),
          username: 'root',
          group: 'g'
        })),
        config: {}
      }
      const r = await window.store
        .importAll({ fileContent: JSON.stringify(payload) })
        .then(r => ({ r }))
        .catch(e => ({ err: String((e && e.message) || e) }))
      return { ...r, reseedCalls: window.__reseedCalls }
    }, size)
    console.log(`[ok] importAll settled: ${JSON.stringify(outcome)}`)

    await delay(5000)

    const after = await readIds(client)
    const kept = ids.filter(i => after.includes(i))
    const imported = after.filter(i => String(i).startsWith('zz-new-')).length
    console.log(`[ok] after: table total ${after.length} (was ${before.length})`)
    console.log(`[ok] pre-existing survivors: ${kept.length} ${JSON.stringify(kept)}`)
    console.log(`[ok] imported rows on disk: ${imported} of ${size}`)

    await electronApp.close()

    // replaced, not appended
    expect(kept.length).equal(0)
    expect(imported).equal(size)
    // nothing aborted, so the rollback hook must not have run
    expect(outcome.reseedCalls).equal(0)
  })
})
