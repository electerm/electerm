import {
  settingSyncId,
  settingShortcutsId,
  settingTerminalId,
  settingAiId
} from '../common/constants'

const e = window.translate

export default () => ([
  {
    id: settingTerminalId,
    title: e('terminal')
  },
  {
    id: settingShortcutsId,
    title: e('settingShortcuts')
  },
  {
    id: settingSyncId,
    title: e('settingSync')
  },
  {
    id: settingAiId,
    title: 'AI'
  }
])
