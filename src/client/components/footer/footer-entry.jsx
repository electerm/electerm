import { auto } from 'manate/react'
import { Select } from 'antd'
import { DashboardOutlined, DoubleRightOutlined } from '@ant-design/icons'
import encodes from '../bookmark-form/common/encodes'
import { refs } from '../common/ref'
import CmdHistory from './cmd-history'
import RemoteMonitorBar from '../remote-monitor/remote-monitor-bar-entry'
import './footer.styl'

export default auto(function FooterEntry ({ store }) {
  function handleSwitchEncoding (encode) {
    refs.get('term-' + store.activeTabId)?.switchEncoding(encode)
  }

  const style = {}
  const tab = store.currentTab
  if (store.openedSideBar && !store.isMobile) {
    style.left = `${store.leftSideBarWidth + store.leftSidePanelWidth}px`
  }
  if (store.rightPanelVisible && store.rightPanelPinned && !store.isMobile) {
    style.right = `${store.rightPanelWidth}px`
  }
  return (
    <div className='main-footer' style={style}>
      <div className='terminal-footer-flex'>
        {tab?.host && (!tab.type || tab.type === 'ssh') && (
          <button
            className='monitor-toggle'
            type='button'
            title={window.translate('remoteMonitorBar')}
            aria-label={window.translate('remoteMonitorBar')}
            aria-pressed={!!store.config.remoteMonitorBarEnabled}
            onClick={() => store.setConfig({ remoteMonitorBarEnabled: !store.config.remoteMonitorBarEnabled })}
          >
            <DashboardOutlined />
          </button>
        )}
        <RemoteMonitorBar store={store} />
        {store.isMobile && store.leftSideBarWidth === 0 && (
          <div className='terminal-footer-unit'>
            <DoubleRightOutlined
              className='pointer font18'
              onClick={() => store.toggleLeftSideBar()}
              title={window.translate('show')}
            />
          </div>
        )}
        {store.inActiveTerminal && (
          <>
            <div className='terminal-footer-unit terminal-footer-history'>
              <CmdHistory store={store} />
            </div>
            <div className='terminal-footer-unit terminal-footer-info'>
              <Select
                value={store.currentTab?.encode || 'utf-8'}
                onSelect={handleSwitchEncoding}
                size='small'
                variant='borderless'
                popupMatchSelectWidth={false}
                options={encodes.map(value => ({ value, label: value.toUpperCase() }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
})
