/**
 * quick command related functions
 */

import {
  settingMap,
  qmSortByFrequencyKey,
  isWin
} from '../common/constants'
import delay from '../common/wait'
import generate from '../common/uid'
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

  Store.prototype.runQuickCommand = function (cmd, inputOnly = false) {
    refs.get('term-' + window.store.activeTabId)?.runQuickCommand(cmd, inputOnly)
  }

  Store.prototype.runQuickCommandItem = debounce(async (id) => {
    const {
      store
    } = window

    const qm = store.currentQuickCommands.find(
      a => a.id === id
    )
    const { runQuickCommand } = store
    const qms = qm && qm.commands
      ? qm.commands
      : (qm && qm.command
          ? [
              {
                command: qm.command,
                id: generate(),
                delay: 100
              }
            ]
          : []
        )
    for (const q of qms) {
      let realCmd = isWin
        ? q.command.replace(/\n/g, '\n\r')
        : q.command

      // Parse templates
      realCmd = await parseTemplates(realCmd)

      await delay(q.delay || 100)
      runQuickCommand(realCmd, qm.inputOnly)
      store.editQuickCommand(qm.id, {
        clickCount: ((qm.clickCount || 0) + 1)
      })
    }
  }, 200)

  Store.prototype.setQmSortByFrequency = function (v) {
    window.store.qmSortByFrequency = v
    ls.setItem(qmSortByFrequencyKey, v ? 'yes' : 'no')
  }

  Store.prototype.handleSortByFrequency = function () {
    window.store.setQmSortByFrequency(!window.store.qmSortByFrequency)
  }
}
