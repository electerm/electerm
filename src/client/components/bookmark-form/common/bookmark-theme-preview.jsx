import { Form } from 'antd'
import { settingMap } from '../../../common/constants'
import ThemeTerminalPreview from '../../theme/theme-terminal-preview.jsx'
import defaultSettings from '../../../common/default-setting'

export default function BookmarkThemePreview ({ form, store }) {
  const themeId = Form.useWatch('themeId', form)
  const fontFamily = Form.useWatch('fontFamily', form) || defaultSettings.fontFamily
  const fontSize = Form.useWatch('fontSize', form) || defaultSettings.fontSize
  const themes = store.getSidebarList(settingMap.terminalThemes)
  const active = themeId
    ? themes.find(t => t.id === themeId)
    : themes.find(t => t.id === store.config.theme)
  const themeConfig = active?.themeConfig || {}

  return (
    <ThemeTerminalPreview
      themeConfig={themeConfig}
      fontFamily={fontFamily}
      fontSize={fontSize}
    />
  )
}
