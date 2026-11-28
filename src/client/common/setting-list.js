import {
  settingSyncId,
  settingShortcutsId,
  settingTerminalId,
  settingPasswordsId
} from '../common/constants'

const e = window.translate

export default () => {
  return [
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
      id: settingPasswordsId,
      title: e('password')
    }
  ]
}
