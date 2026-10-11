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
import { recordedSteps } from '../components/terminal/automation/record-steps'
import { createOutputWatch } from '../components/terminal/automation/output-watch'
import { sharedAsk } from '../components/terminal/automation/shared-ask'
import generate from '../common/uid'
import message from '../components/common/message'
import translateOr from '../common/translate-fallback'
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
      waitFor: last.waitFor,
      asking: last.asking,
      count: visible.length
    }
  } else {
    delete next[tabId]
  }
  store.runningQuickCommands = next
}

// the tab being recorded and what was typed in it, one chunk per onData call.
// Kept out of the reactive store, the store only gets the step count.
let recording = null

// prompt steps waiting for the user, oldest first. The store only gets what
// the dialog shows, the resolve functions stay here.
const prompts = []

function publishPrompts () {
  window.store.qmPrompts = prompts.map(({ resolve, ...p }) => p)
}

function openPrompt (step, qm) {
  let resolve
  const answer = new Promise(_resolve => { resolve = _resolve })
  const prompt = {
    id: generate(),
    name: qm.name,
    label: step.value,
    hidden: step.hidden,
    resolve
  }
  prompts.push(prompt)
  publishPrompts()
  return {
    answer,
    cancel: () => answerPrompt(prompt.id, null)
  }
}

function answerPrompt (id, value) {
  const i = prompts.findIndex(p => p.id === id)
  if (i < 0) {
    return
  }
  const [prompt] = prompts.splice(i, 1)
  publishPrompts()
  prompt.resolve(value)
}

// Send every step to one tab. The steps are spaced by delays, and the user
// can switch tabs in between.
function runInTab (qm, tabId, askInput) {
  const { store } = window
  const getTerm = () => refs.get('term-' + tabId)
  const steps = quickCommandSteps(qm, { isWin })
  const entry = { qm, index: 0, total: steps.length, visible: false }
  // wait steps read the tab's output from the start of the run
  const watch = createOutputWatch()
  const untap = steps.some(s => s.type === 'wait')
    ? getTerm()?.attachAddon?.addDataTap?.(watch.push)
    : null
  const run = runSteps(steps, {
    send: data => {
      watch.mark()
      getTerm()?.attachAddon?._sendData(data)
    },
    watchText: watch.watch,
    askInput,
    isAlive: () => !!getTerm()?.attachAddon,
    resolveText: parseTemplates,
    getKeyOptions: () => ({
      applicationCursor: !!getTerm()?.term?.modes?.applicationCursorKeysMode
    }),
    onStep: (index, step) => {
      entry.index = index
      entry.waitFor = step.type === 'wait' ? step.value : ''
      entry.asking = step.type === 'prompt'
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
    untap?.()
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
    } else if (result.status === 'timeout') {
      const step = steps[result.index]
      message.warning(
        `${translateOr('waitTimedOut', 'Timed out waiting for')} "${step.value}" (${qm.name})`
      )
    }
    return result
  })
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

  // runs the quick command in the given tabs, the active tab by default
  Store.prototype.runQuickCommandItem = debounce((id, tabIds) => {
    const {
      store
    } = window

    const qm = store.currentQuickCommands.find(
      a => a.id === id
    )
    if (!qm) {
      return
    }
    const ids = tabIds && tabIds.length ? tabIds : [store.activeTabId]
    if (ids.includes(store.activeTabId)) {
      refs.get('term-' + store.activeTabId)?.term?.focus()
    }
    const askInput = sharedAsk(step => openPrompt(step, qm))
    return Promise.all(ids.map(tabId => runInTab(qm, tabId, askInput)))
  }, 200)

  // open the terminal picker for a quick command
  Store.prototype.openQmRunInTabs = function (id) {
    const { store } = window
    store.filterBatchInputSelectedTabIds()
    store.qmRunInTabsId = id
  }

  Store.prototype.editQuickCommandItem = function (id) {
    const { store } = window
    store.storeAssign({
      settingTab: settingMap.quickCommands
    })
    // the settings list holds copies; selecting the live store object
    // instead freezes the page
    const qm = store.settingSidebarList.find(a => a.id === id)
    if (!qm) {
      return
    }
    store.setSettingItem(qm)
    store.openSettingModal()
  }

  // value is null when the user cancels
  Store.prototype.answerQmPrompt = function (id, value) {
    answerPrompt(id, value)
    const { store } = window
    refs.get('term-' + store.activeTabId)?.term?.focus()
  }

  // stops every quick command running in the tab
  Store.prototype.stopQuickCommand = function (tabId) {
    const tid = tabId || window.store.activeTabId
    for (const entry of runs.get(tid) || []) {
      entry.run.stop()
    }
  }

  // record what the user types in a tab, to save as a quick command
  Store.prototype.startQuickCommandRecording = function (tabId) {
    const { store } = window
    const tid = tabId || store.activeTabId
    const term = refs.get('term-' + tid)
    if (!term) {
      return
    }
    recording = { tabId: tid, chunks: [] }
    store.qmRecording = { tabId: tid, count: 0 }
    term.term?.focus()
  }

  // called with every chunk of user input, from the terminal's onData
  Store.prototype.recordQuickCommandInput = function (tabId, data) {
    if (!recording || recording.tabId !== tabId) {
      return
    }
    recording.chunks.push(data)
    const { store } = window
    const count = recordedSteps(recording.chunks).length
    if (count !== store.qmRecording?.count) {
      store.qmRecording = { tabId, count }
    }
  }

  // save: open the recorded steps in the new quick command form
  Store.prototype.stopQuickCommandRecording = function (save = true) {
    const { store } = window
    const r = recording
    recording = null
    store.qmRecording = null
    if (!save || !r) {
      return
    }
    const steps = recordedSteps(r.chunks, generate)
    if (!steps.length) {
      message.info(translateOr('nothingRecorded', 'Nothing was recorded'))
      return
    }
    store.qmRecordedSteps = steps
  }

  Store.prototype.setQmSortByFrequency = function (v) {
    window.store.qmSortByFrequency = v
    ls.setItem(qmSortByFrequencyKey, v ? 'yes' : 'no')
  }

  Store.prototype.handleSortByFrequency = function () {
    window.store.setQmSortByFrequency(!window.store.qmSortByFrequency)
  }
}
