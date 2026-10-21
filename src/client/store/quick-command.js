/**
 * quick command related functions
 */

import {
  settingMap,
  qmSortByFrequencyKey,
  qmGroupByLabelKey,
  qmCollapsedLabelsKey,
  isWin
} from '../common/constants'
import { quickCommandSteps } from '../common/quick-command-steps'
import { runSteps } from '../components/terminal/automation/step-runner'
import { createRecorder } from '../components/terminal/automation/record-steps'
import { createOutputWatch } from '../components/terminal/automation/output-watch'
import { createAskGroup } from '../components/terminal/automation/ask-group'
import generate from '../common/uid'
import message from '../components/common/message'
import * as ls from '../common/safe-local-storage'
import { debounce } from 'lodash-es'
import { refs } from '../components/common/ref'
import templates from '../components/quick-commands/templates'
import { readClipboardAsync } from '../common/clipboard'

const e = window.translate

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
  window.store.qmPrompts = prompts.map(({ resolve, onShared, ...p }) => p)
}

// tabId is set when each terminal gets its own dialog
function openPrompt ({ step, qm, tabId, shared, multi, onShared }) {
  let resolve
  const answer = new Promise(_resolve => { resolve = _resolve })
  const { tabs } = window.store
  const tabIndex = tabs.findIndex(t => t.id === tabId)
  const prompt = {
    id: generate(),
    name: qm.name,
    label: step.value,
    hidden: step.hidden,
    multi,
    shared,
    tabTitle: tabIndex < 0 ? '' : `${tabIndex + 1}. ${tabs[tabIndex].title}`,
    resolve,
    onShared
  }
  prompts.push(prompt)
  publishPrompts()
  return {
    answer,
    close: () => removePrompt(prompt.id)
  }
}

function removePrompt (id) {
  const i = prompts.findIndex(p => p.id === id)
  if (i < 0) {
    return null
  }
  const [prompt] = prompts.splice(i, 1)
  publishPrompts()
  return prompt
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
        `${e('waitTimedOut')} "${step.value}" (${qm.name})`
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

  // runs the quick command in the given tabs, the active tab by default. An
  // empty list runs nothing: the terminal picker can come back with no tab.
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
    const ids = Array.isArray(tabIds) ? tabIds : [store.activeTabId]
    if (!ids.length) {
      return
    }
    if (ids.includes(store.activeTabId)) {
      refs.get('term-' + store.activeTabId)?.term?.focus()
    }
    // count the run, not the steps: frequency sorting follows how often a
    // quick command is used
    store.editQuickCommand(qm.id, {
      clickCount: ((qm.clickCount || 0) + 1)
    })
    const multi = ids.length > 1
    const group = createAskGroup(({ step, tabId, shared }) => openPrompt({
      step, qm, tabId, shared, multi, onShared: group.setShared
    }))
    return Promise.all(ids.map(tabId => runInTab(
      qm, tabId, (step, index) => group.ask(step, index, tabId)
    )))
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
    removePrompt(id)?.resolve(value)
    const { store } = window
    refs.get('term-' + store.activeTabId)?.term?.focus()
  }

  // "send to all terminals" in a prompt dialog
  Store.prototype.setQmPromptShared = function (id, shared) {
    prompts.find(p => p.id === id)?.onShared(shared)
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
    // steps are built as input arrives, so a long recording is not parsed
    // again on every key press
    recording = { tabId: tid, recorder: createRecorder(generate) }
    store.qmRecording = { tabId: tid, count: 0 }
    // every keystroke is kept, so a password typed during the recording
    // would end up in the quick command and in sync
    message.warning(e('recordingSecretsWarning'))
    term.term?.focus()
  }

  // called with every chunk of user input, from the terminal's onData
  Store.prototype.recordQuickCommandInput = function (tabId, data) {
    if (!recording || recording.tabId !== tabId) {
      return
    }
    const { store } = window
    recording.recorder.push(data)
    const count = recording.recorder.count()
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
    const steps = r.recorder.done()
    if (!steps.length) {
      message.info(e('nothingRecorded'))
      return
    }
    store.qmRecordedSteps = steps
  }

  Store.prototype.setQmSortByFrequency = function (v) {
    window.store.qmSortByFrequency = v
    ls.setItem(qmSortByFrequencyKey, v ? 'yes' : 'no')
  }

  Store.prototype.setQmGroupByLabel = function (v) {
    window.store.qmGroupByLabel = v
    ls.setItem(qmGroupByLabelKey, v ? 'yes' : 'no')
  }

  Store.prototype.toggleQmLabelCollapsed = function (label) {
    const { store } = window
    const list = store.qmCollapsedLabels
    const next = list.includes(label)
      ? list.filter(l => l !== label)
      : [...list, label]
    store.qmCollapsedLabels = next
    ls.setItemJSON(qmCollapsedLabelsKey, next)
  }

  Store.prototype.handleSortByFrequency = function () {
    window.store.setQmSortByFrequency(!window.store.qmSortByFrequency)
  }
}
