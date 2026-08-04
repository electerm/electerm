import {
  settingSyncId,
  settingShortcutsId,
  settingTerminalId,
  settingAiId,
  settingPasswordsId
} from '../common/constants'
import { isAIDisabled } from './ai-feature'

const e = window.translate

export default () => {
  const list = [
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
    },
    {
      id: settingPasswordsId,
      title: e('password')
    }
  ]
  if (isAIDisabled()) {
    return list.filter(item => item.id !== settingAiId)
  }
  return list
}
