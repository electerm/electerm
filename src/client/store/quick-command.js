/**
 * quick command related functions
 */

import {
  settingMap,
  qmSortByFrequencyKey,
  isWin
} from '../common/constants'
import { quickCommandSteps } from '../common/quick-command-steps'
import { runSteps } from '../components/terminal/automation/step-runner'
import * as ls from '../common/safe-local-storage'
import { debounce } from 'lodash-es'
import { refs } from '../components/common/ref'
import templates from '../components/quick-commands/templates'
import { readClipboardAsync } from '../common/clipboard'

// Function to parse templates in command string
async function parseTemplates (cmd) {
  if (!cmd.includes('{{')) return cmd

  // Process each template from templates.js
  for (const template of templates) {
    const placeholder = `{{${template}}}`
    if (cmd.includes(placeholder)) {
      let replacement = ''

      // Handle each supported template using if-else
      if (template === 'clipboard') {
        replacement = await readClipboardAsync()
      } else if (template === 'time') {
        replacement = Date.now()
      } else if (template === 'date') {
        replacement = new Date().toLocaleDateString()
      }
      // Add more conditions for any new templates as needed

      cmd = cmd.replaceAll(placeholder, replacement)
    }
  }

  return cmd
}

// running quick commands by tab id: a Set of { run, qm, index, total }.
// Kept out of the reactive store, the store only gets a summary.
const runs = new Map()
// show a run in the footer and tab only when it lasts longer than this, so
// quick commands that finish at once don't flash the UI
const showRunAfter = 500

function publishRuns (tabId) {
  const { store } = window
  const visible = [...(runs.get(tabId) || [])].filter(r => r.visible)
  const next = { ...store.runningQuickCommands }
  if (visible.length) {
    const last = visible[visible.length - 1]
    next[tabId] = {
      name: last.qm.name,
      index: last.index,
      total: last.total,
      count: visible.length
    }
  } else {
    delete next[tabId]
  }
  store.runningQuickCommands = next
}

export default Store => {
  Store.prototype.addQuickCommand = function (
    qm
  ) {
    window.store.addItem(qm, settingMap.quickCommands)
  }

  Store.prototype.editQuickCommand = function (id, update) {
    window.store.editItem(id, update, settingMap.quickCommands)
  }

  Store.prototype.delQuickCommand = function ({ id }) {
    window.store.delItem({ id }, settingMap.quickCommands)
  }

  Store.prototype.runQuickCommand = function (cmd, inputOnly = false, tabId) {
    const tid = tabId || window.store.activeTabId
    refs.get('term-' + tid)?.runQuickCommand(cmd, inputOnly)
  }

  Store.prototype.runQuickCommandItem = debounce((id) => {
    const {
      store
    } = window

    const qm = store.currentQuickCommands.find(
      a => a.id === id
    )
    if (!qm) {
      return
    }
    // Send every step to the tab the quick command started in. The steps are
    // spaced by delays, and the user can switch tabs in between.
    const tabId = store.activeTabId
    const getTerm = () => refs.get('term-' + tabId)
    getTerm()?.term?.focus()
    const steps = quickCommandSteps(qm, { isWin })
    const entry = { qm, index: 0, total: steps.length, visible: false }
    const run = runSteps(steps, {
      send: data => getTerm()?.attachAddon?._sendData(data),
      isAlive: () => !!getTerm()?.attachAddon,
      resolveText: parseTemplates,
      getKeyOptions: () => ({
        applicationCursor: !!getTerm()?.term?.modes?.applicationCursorKeysMode
      }),
      onStep: (index) => {
        entry.index = index
        if (entry.visible) {
          publishRuns(tabId)
        }
        store.editQuickCommand(qm.id, {
          clickCount: ((qm.clickCount || 0) + 1)
        })
      }
    })
    entry.run = run
    if (!runs.has(tabId)) {
      runs.set(tabId, new Set())
    }
    runs.get(tabId).add(entry)
    const timer = setTimeout(() => {
      entry.visible = true
      publishRuns(tabId)
    }, showRunAfter)
    return run.done.then(result => {
      clearTimeout(timer)
      const set = runs.get(tabId)
      set.delete(entry)
      if (!set.size) {
        runs.delete(tabId)
      }
      if (entry.visible) {
        publishRuns(tabId)
      }
      if (result.status === 'error') {
        store.onError(result.error)
      }
      return result
    })
  }, 200)

  // stops every quick command running in the tab
  Store.prototype.stopQuickCommand = function (tabId) {
    const tid = tabId || window.store.activeTabId
    for (const entry of runs.get(tid) || []) {
      entry.run.stop()
    }
  }

  Store.prototype.setQmSortByFrequency = function (v) {
    window.store.qmSortByFrequency = v
    ls.setItem(qmSortByFrequencyKey, v ? 'yes' : 'no')
  }

  Store.prototype.handleSortByFrequency = function () {
    window.store.setQmSortByFrequency(!window.store.qmSortByFrequency)
  }
}
