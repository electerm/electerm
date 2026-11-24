import { CodeFilled, FileAddOutlined, LayoutFilled, SettingFilled, SunOutlined, MoonOutlined } from '@ant-design/icons'
import { auto } from 'manate/react'
import { defaultThemeId, defaultThemeLightId } from '../../common/theme-defaults'
import LayoutMenu from '../tabs/layout-menu'

const e = window.translate
export const toolbarHeight = 36

export default auto(function TerminalToolbar ({ store, controlsRef, transfers }) {
  const light = store.config.theme === defaultThemeLightId
  return (
    <div role='toolbar' aria-label={e('terminal')} className='terminal-toolbar' style={{ height: toolbarHeight }}>
      <button type='button' title={e('newBookmark')} aria-label={e('newBookmark')} onClick={() => store.onNewSsh()}>
        <FileAddOutlined /><span className='tool-label'>{e('newBookmark')}</span>
      </button>
      {store.hasNodePty && (
        <button type='button' title={e('local')} aria-label={e('local')} onClick={() => store.addTab(undefined, undefined, store.currentLayoutBatch)}>
          <CodeFilled /><span className='tool-label'>{e('local')}</span>
        </button>
      )}
      <div className='toolbar-session-controls' ref={controlsRef} />
      {transfers}
      <LayoutMenu layout={store.layout}>
        <button type='button' className='layout-menu-trigger' title={e('split')} aria-label={e('split')}><LayoutFilled />{e('split')}</button>
      </LayoutMenu>
      <button type='button' title={e('settings')} aria-label={e('settings')} onClick={() => store.openSetting()}>
        <SettingFilled />{e('settings')}
      </button>
      <button type='button' className='theme-toggle' title={e('uiThemes')} aria-label={e('uiThemes')} onClick={() => store.setTheme(light ? defaultThemeId : defaultThemeLightId)}>
        {light ? <MoonOutlined /> : <SunOutlined />}{e('uiThemes')}
      </button>
    </div>
  )
})
