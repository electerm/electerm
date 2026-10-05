/*
 * Live reproduction of bookmark loss, driven through the real store + watcher
 * in a running electerm instance.
 *
 * Two experiments, both using only code paths the app itself uses.
 *
 * ---------------------------------------------------------------------------
 * EXPERIMENT 1 - a cancelled importAll used to delete every bookmark
 * ---------------------------------------------------------------------------
 * The store used to be emptied BEFORE the import ran, "because importAll
 * replaces data sets, not appends":
 *
 *     action(() => { for (const n of names) store.setItems(n, []) })()
 *     await runImportTask({ ..., stopWatchers: names, ... })
 *
 * runImportTask stops the db watchers so the chunked writes do not trigger a
 * diff, and restarts them in a finally block. If the import was cancelled, or
 * any step threw, the watchers restarted while the store was STILL EMPTY while
 * the snapshot seeded at initData (src/client/store/load-data.js) still held
 * the full table. The diff in src/client/store/watch.js then classified every
 * real record as `removed` and deleted it:
 *
 *     ...removed.map(item => remove(name, item.id))
 *
 * The import file was never even read. The bookmarks were simply gone.
 *
 * Fixed by moving the clear INSIDE the task (so it happens while the watchers
 * are stopped), keeping a backup, and on abort restoring the store, calling
 * watch.js's new reseed() to make the current contents the baseline, and only
 * then restarting. This experiment now pins that down in two halves: half A
 * runs the fixed sequence and requires nothing to be lost, half B runs the old
 * sequence with the reseed left out and requires the rows to disappear -- the
 * guard has to be load-bearing, not decorative.
 *
 * The end-to-end proof that the real entry point behaves this way lives in
 * 0991.import-cancel-fix.spec.js, which drives store.importAll and cancels it
 * through the progress modal's cancel button.
 *
 * ---------------------------------------------------------------------------
 * EXPERIMENT 2 - a failed load-stage read empties the store, and the next
 *                ordinary write wipes the table
 * ---------------------------------------------------------------------------
 * src/client/common/db.js:20   .catch(handleError) -> undefined, error lost
 * src/client/common/db.js:133  find() || []          -> "failed" == "empty"
 *
 * Verified live: after a rejected read the store holds 0 bookmarks while the
 * db still holds all of them. The snapshot is re-seeded empty at the same time
 * (load-data.js:306), so on its own nothing is deleted - which is why a plain
 * reload does NOT lose data. The deletion needs the snapshot to be stale
 * relative to the store, which is exactly what experiment 1 produces.
 *
 * Run (own DATA_PATH/TMPDIR; common/app-options.js supplies a throwaway
 * Electron userData so a bundle cached by an earlier build can not be picked up
 * -- see the note there, it is why a rebuilt app can still run the old code):
 *   rm -rf /tmp/dbcorrupt4 && mkdir -p /tmp/dbcorrupt4/{data,tmp}
 *   TMPDIR=/tmp/dbcorrupt4/tmp DATA_PATH=/tmp/dbcorrupt4/data \
 *     ELECTERM_E2E_NO_SANDBOX=1 \
 *     npx playwright test src/test/e2e/099.db-corruption.spec.js --workers=1
 *
 * ELECTERM_E2E_NO_SANDBOX=1 is only for environments where Electron's sandbox
 * can not initialize; drop it elsewhere. `env -u ELECTRON_RUN_AS_NODE
 * -u NODE_OPTIONS` is needed when the tests are launched from a shell that
 * already runs on an Electron runtime.
 */

const { _electron: electron } = require('@playwright/test')
const { test: it } = require('@playwright/test')
const { describe } = it
it.setTimeout(240000)
const { expect } = require('./common/expect')
const delay = require('./common/wait')
const appOptions = require('./common/app-options')
const extendClient = require('./common/client-extend')

async function readIds (client, name) {
  return client.evaluate(async n => {
    const res = await window.pre.runGlobalAsync('dbAction', n, 'find', {})
    return (res || []).map(d => d.id || d._id)
  }, name)
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

describe('db corruption repro', function () {
  it('exp 1: restarting a watcher over an emptied store only stays safe if it is reseeded first', async function () {
    const ids = ['zz-imp1', 'zz-imp2', 'zz-imp3', 'zz-imp4', 'zz-imp5']
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5000)

    await seed(client, ids)
    const before = await readIds(client, 'bookmarks')
    console.log(`[exp1] seeded: ${ids.filter(i => before.includes(i)).length}/${ids.length} on disk, table total ${before.length}`)
    expect(ids.filter(i => before.includes(i)).length).equal(5)

    // --- half A: the fixed sequence, as import-task.js now performs it -----
    // Order matters and mirrors runImportTask: stopWatchers first (line 115),
    // then the clear runs inside the steps, then on abort the store is put
    // back, reseed() makes that the watcher's baseline, and only then does the
    // watcher restart. The restart therefore diffs "7 bookmarks" against
    // "7 bookmarks" and writes nothing.
    const fixed = await client.evaluate(async () => {
      const { store } = window
      const backup = JSON.parse(JSON.stringify(store.getItems('bookmarks')))
      window.watchbookmarks?.stop()
      await new Promise(resolve => setTimeout(resolve, 300))
      store.setItems('bookmarks', [])
      await new Promise(resolve => setTimeout(resolve, 300))
      // onAbort -> roll the store back -> reseed -> start
      store.setItems('bookmarks', backup)
      window.watchbookmarks?.reseed()
      window.watchbookmarks?.start()
      return { storeCount: store.bookmarks.length, backedUp: backup.length }
    })
    console.log(`[exp1] half A (reseed before start): store ${fixed.storeCount}, restored ${fixed.backedUp}`)

    await delay(4000)
    const afterA = await readIds(client, 'bookmarks')
    const lostA = ids.filter(i => !afterA.includes(i))
    console.log(`[exp1] half A -> table total ${afterA.length} (was ${before.length}), LOST ${lostA.length}`)
    expect(lostA.length).equal(0)

    // --- half B: the same sequence with the reseed left out ----------------
    // This is what the code did before the fix, and it is the whole bug: the
    // store is empty while the snapshot still describes the full table, so
    // every record is classified as `removed`. Kept as a characterisation of
    // the mechanism -- if this ever stops losing the rows, reseed() is no
    // longer what is holding the fix up and the reasoning above needs revisiting.
    const unfixed = await client.evaluate(async () => {
      const { store } = window
      window.watchbookmarks?.stop()
      await new Promise(resolve => setTimeout(resolve, 300))
      store.setItems('bookmarks', [])
      await new Promise(resolve => setTimeout(resolve, 300))
      // import-task.js's old finally block: restart with no reseed
      window.watchbookmarks?.start()
      return { storeCount: store.bookmarks.length }
    })
    console.log(`[exp1] half B (no reseed): store holds ${unfixed.storeCount}`)

    await delay(4000)

    const after = await readIds(client, 'bookmarks')
    const lost = ids.filter(i => !after.includes(i))
    const collateral = before.filter(i => !after.includes(i) && !ids.includes(i))
    console.log(`[exp1] half B -> table total ${after.length} (was ${before.length})`)
    console.log(`[exp1] LOST ours: ${lost.length} ${JSON.stringify(lost)}`)
    console.log(`[exp1] collateral (pre-existing also gone): ${collateral.length}` +
      (collateral.length ? ` e.g. ${JSON.stringify(collateral.slice(0, 8))}` : ''))

    await electronApp.close()
    // the guard is what stands between an aborted import and a deleted table
    expect(lost.length).equal(5)
  })

  it('exp 2: a failed read empties the store while disk still has the data', async function () {
    const ids = ['zz-fail1', 'zz-fail2', 'zz-fail3', 'zz-fail4', 'zz-fail5', 'zz-fail6']
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5000)

    await seed(client, ids)
    const before = await readIds(client, 'bookmarks')
    console.log(`[exp2] seeded: ${ids.filter(i => before.includes(i)).length}/${ids.length} on disk, table total ${before.length}`)
    expect(ids.filter(i => before.includes(i)).length).equal(6)

    // fail the read for 'bookmarks' and re-run the load stage
    const state = await client.evaluate(async () => {
      const realRun = window.pre.runGlobalAsync
      window.pre.runGlobalAsync = async (name, ...args) => {
        if (name === 'dbAction' && args[0] === 'bookmarks' && args[1] === 'find') {
          throw new Error('SQLITE_CORRUPT: database disk image is malformed')
        }
        return realRun(name, ...args)
      }
      window.__restore = () => { window.pre.runGlobalAsync = realRun }
      window.store.initData()
      return true
    })
    expect(state).equal(true)
    await delay(4000)

    const storeCount = await client.evaluate(() => window.store.bookmarks.length)
    // restore the bridge BEFORE reading the db, otherwise our own stub rejects
    await client.evaluate(() => window.__restore && window.__restore())
    const diskNow = await client.evaluate(async () => {
      const res = await window.pre.runGlobalAsync('dbAction', 'bookmarks', 'find', {})
      return (res || []).length
    })
    console.log(`[exp2] store believes: ${storeCount} bookmarks`)
    console.log(`[exp2] disk actually has: ${diskNow} bookmarks`)
    console.log('[exp2] => the read failed and the app cannot tell "failed" from "empty"')

    await electronApp.close()

    // documents the enabling condition: store and disk disagree, with no
    // error surfaced. This assertion passes; it is the baseline that makes
    // exp1's failure explicable.
    expect(storeCount).equal(0)
  })

  it('exp 3: a clean reload keeps the data (the control)', async function () {
    const ids = ['zz-ctl1', 'zz-ctl2', 'zz-ctl3']
    const electronApp = await electron.launch(appOptions)
    const client = await electronApp.firstWindow()
    extendClient(client, electronApp)
    await delay(5000)

    await seed(client, ids)
    const before = await readIds(client, 'bookmarks')
    expect(ids.filter(i => before.includes(i)).length).equal(3)

    await client.evaluate(() => window.location.reload())
    await delay(1200)
    await delay(3500)

    const after = await readIds(client, 'bookmarks')
    const lost = ids.filter(i => !after.includes(i))
    console.log(`[exp3] before=${before.length} after=${after.length} lost=${JSON.stringify(lost)}`)
    await electronApp.close()
    expect(lost.length).equal(0)
  })
})
