import {
  settingSyncId,
  settingShortcutsId,
  settingTerminalId,
  settingAIId,
  settingPasswordsId
} from '../common/constants'
import { isAIDisabled } from './ai-feature'

const e = window.translate

export default () => {
  return [
    {
      id: settingTerminalId,
      title: e('terminal')
    },
    ...(isAIDisabled() ? [] : [{ id: settingAIId, title: 'AI' }]),
    {
      id: settingShortcutsId,
      title: e('settingShortcuts')
    },
    {
      id: settingSyncId,
      title: e('settingSync')
    },
    {
      id: settingPasswordsId,
      title: e('password')
    }
  ]
}
