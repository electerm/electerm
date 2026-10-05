/**
 * Shared chunked import task runner (no UI).
 *
 * Runs large data imports (bookmarks, quick commands, all-data) in small
 * batches, yielding to the UI between batches and pausing db watchers while
 * running, so a big import can not freeze or crash the app. Progress is
 * reported through the ImportProgress modal mounted in main.jsx (driven via
 * refsStatic) and through the onProgress callback.
 */

import { action } from 'manate'
import { refsStatic } from '../components/common/ref'

export const importProgressRefKey = 'import-progress'

function yieldToUI (idleMs = 0) {
  // rAF fires *before* paint; pairing it with setTimeout(0) - a macrotask
  // that runs *after* paint - guarantees the browser actually paints
  // between batches instead of coalescing them into one long frame.
  // idleMs adds a real idle gap after paint so input events, hover and
  // the mouse cursor get a chance to be handled between batches
  return new Promise(resolve => {
    const finish = () => {
      if (idleMs > 0) {
        setTimeout(resolve, idleMs)
      } else {
        resolve()
      }
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(finish, 0))
      return
    }
    setTimeout(finish, 0)
  })
}

let controller = null

export function cancelImportTask () {
  if (controller) {
    controller.cancelled = true
  }
}

/**
 * Run an import task in UI-friendly batches with a progress modal.
 * @param {Object} options
 * @param {string} options.title modal title (already translated label)
 * @param {Array} options.steps list of steps, each either
 *   `{ label, items, process(chunk, step) }` - chunked store mutations, or
 *   `{ label, weight, run(step) }` - a single (async) unit of work
 * @param {number} options.batch items per store-mutation batch
 * @param {number} options.batchIdle ms of idle time after each batch's
 *   paint (default 16); keeps the UI responsive to input while importing
 * @param {boolean} options.cancelable show a cancel button (default true)
 * @param {boolean} options.useModal show the progress modal (default true)
 * @param {number} options.modalMinTotal skip the modal below this total (default 200)
 * @param {string[]} options.stopWatchers db watcher names (window.watchXxx)
 *   to pause during the task, so chunked writes do not trigger a db diff
 *   per batch; watchers restart one per frame after the steps finish
 * @param {Function} options.onAbort called as ({cancelled, error}) when the
 *   task did NOT run to completion, BEFORE the watchers restart. A stopped
 *   watcher cannot observe store changes, so its snapshot only describes the
 *   db while the task ran to completion; after a cancel/throw the store may
 *   hold a partial result while the snapshot still describes the pre-task
 *   table. Restarting there would classify every untouched record as
 *   `removed` and delete it, so the caller must use this hook to put the
 *   store back in sync with the snapshot first.
 * @param {Function} options.onProgress called as (current, total) per batch
 * @returns {Promise<{cancelled: boolean, error: Error|null}>}
 */
export async function runImportTask (options) {
  const {
    title = '',
    steps = [],
    batch = 100,
    batchIdle = 16,
    cancelable = true,
    useModal = true,
    modalMinTotal = 200,
    stopWatchers = [],
    onAbort,
    onProgress
  } = options
  if (controller) {
    console.warn('Another import task is already running')
    return { cancelled: false, error: new Error('Another import task is already running') }
  }
  const total = steps.reduce((p, s) => {
    return p + (Array.isArray(s.items) ? s.items.length : (s.weight || 1))
  }, 0) + stopWatchers.length
  const showModal = useModal && total >= modalMinTotal
  const modal = refsStatic.get(importProgressRefKey)
  controller = { cancelled: false }
  let done = 0
  const update = (ext) => {
    if (onProgress) {
      onProgress(done, total)
    }
    if (!showModal || !modal) {
      return
    }
    modal.show({
      title,
      status: 'running',
      current: done,
      total,
      label: '',
      cancelable,
      ...ext
    })
  }
  update({})
  for (const name of stopWatchers) {
    window[`watch${name}`]?.stop()
  }
  let error = null
  const restarted = new Set()
  try {
    for (const step of steps) {
      if (controller.cancelled) {
        break
      }
      const { label, items, process, run } = step
      if (Array.isArray(items) && typeof process === 'function') {
        for (let i = 0; i < items.length; i += batch) {
          if (controller.cancelled) {
            break
          }
          // paint the last batch, then leave a real idle gap so the UI
          // can handle input/cursor events before the next batch
          await yieldToUI(batchIdle)
          const chunk = items.slice(i, i + batch)
          action(() => process(chunk, step))()
          done += chunk.length
          update({ label })
        }
      } else if (typeof run === 'function') {
        await yieldToUI()
        await run(step)
        done += step.weight || 1
        update({ label })
      }
    }
  } catch (err) {
    error = err
  }

  // A watcher that was stopped cannot observe store changes, so its snapshot
  // is only a faithful description of the db while the task ran to completion.
  // After a cancel or a throw the store can hold a partial result while the
  // snapshot still describes the pre-task table; the restart below would then
  // diff "snapshot \ store" and delete every record the task never touched.
  // Let the caller reconcile the store with the snapshot first.
  const aborted = controller.cancelled || !!error
  if (aborted && typeof onAbort === 'function') {
    try {
      await onAbort({ cancelled: controller.cancelled, error })
    } catch (abortErr) {
      // the abort hook is best effort - a failure there must not stop the
      // watchers from coming back up
      error = error || abortErr
    }
  }

  try {
    // restart watchers one per frame - each start() synchronously diffs
    // + deep-copies its collection and writes to db, so restarting all at
    // once would freeze the UI right when the import "finishes"
    for (const name of stopWatchers) {
      await yieldToUI(batchIdle)
      // after an abort the store was just put back to its pre-task state;
      // make that the watcher's baseline so the restart is a no-op instead of
      // a mass deletion. reseed() is a no-op for watchers that do not have it.
      if (aborted) {
        window[`watch${name}`]?.reseed?.()
      }
      window[`watch${name}`]?.start()
      restarted.add(name)
      done += 1
      update({ label: name })
    }
  } catch (restartErr) {
    // a watcher failing to come back up is reported through the return value,
    // like every other failure here, and must not mask the original error
    error = error || restartErr
  } finally {
    // on error/cancel still make sure everything is restarted
    for (const name of stopWatchers) {
      if (!restarted.has(name)) {
        try {
          window[`watch${name}`]?.start()
        } catch (e) {
          error = error || e
        }
      }
    }
  }
  const { cancelled } = controller
  controller = null
  if (error) {
    if (showModal && modal) {
      modal.show({ title, status: 'error', error, current: done, total, cancelable: false })
    }
  } else if (!cancelled) {
    if (showModal && modal) {
      modal.show({ title, status: 'done', current: total, total, cancelable: false })
      setTimeout(() => {
        modal.hide()
      }, 600)
    }
  } else if (showModal && modal) {
    modal.hide()
  }
  return { cancelled, error }
}
