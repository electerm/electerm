import {
  settingShortcutsId,
  settingTerminalId,
  settingPasswordsId
} from '../common/constants'

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
      id: settingPasswordsId,
      title: e('password')
    }
  ]
  return list
}
