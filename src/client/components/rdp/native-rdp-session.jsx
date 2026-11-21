import { Component } from 'manate/react/class-components'
import { Button, Space } from 'antd'
import { statusMap } from '../../common/constants'
import { openNativeRdp } from './native-rdp.js'

const e = window.translate

const launchStatusText = {
  [statusMap.success]: e('openedWithExternalRdp'),
  [statusMap.processing]: e('openedWithExternalRdp') + '...',
  [statusMap.error]: 'Could not open the external RDP client'
}

// Track launches by tab ID across remounts while Windows is starting.
const launchingTabs = new Set()

export default class NativeRdpSession extends Component {
  componentDidMount () {
    // Fresh tabs start in processing. Reloaded and duplicated tabs start idle.
    if (this.props.tab.status === statusMap.processing) {
      this.handleLaunch()
    }
  }

  handleLaunch = async () => {
    const { tab, editTab } = this.props
    const { id } = tab
    if (launchingTabs.has(id)) {
      return
    }
    launchingTabs.add(id)
    try {
      editTab(id, { status: statusMap.processing })
      const opened = await openNativeRdp(tab)
      if (tab.nativeRdp) {
        editTab(id, { status: opened ? statusMap.success : statusMap.error })
      }
    } finally {
      launchingTabs.delete(id)
    }
  }

  handleSwitchToBuiltIn = () => {
    const { tab, editTab } = this.props
    editTab(tab.id, { nativeRdp: false, status: statusMap.processing })
  }

  render () {
    const { status } = this.props.tab
    return (
      <div className='external-rdp-session'>
        <Space direction='vertical' align='center' size='middle'>
          <h3 role='status'>{launchStatusText[status] || 'External RDP client'}</h3>
          <div>Use the separate Windows Remote Desktop window to sign in.</div>
          <Space wrap>
            <Button loading={status === statusMap.processing} onClick={this.handleLaunch}>
              {e('openedWithExternalRdp')}
            </Button>
            <Button type='primary' onClick={this.handleSwitchToBuiltIn}>
              {e('switchToBuiltInRdp')}
            </Button>
          </Space>
        </Space>
      </div>
    )
  }
}
