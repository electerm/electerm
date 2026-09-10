import { Select } from 'antd'
import SwitchLabel from '../common/switch'
import {
  REMOTE_MONITOR_ITEM_IDS,
  normalizeRemoteMonitorItems
} from '../remote-monitor/monitor-model'

const { Option } = Select
const e = window.translate

export default function SettingRemoteMonitor (props) {
  const { config, store } = props
  const value = normalizeRemoteMonitorItems(config.remoteMonitorBarItems)
    .filter(item => item.enabled)
    .map(item => item.id)

  return (
    <section className='remote-monitor-setting pd2b'>
      <div className='pd1b'>{e('remoteMonitorBar')}</div>
      <SwitchLabel
        checked={!!config.remoteMonitorBarEnabled}
        className='mg1b'
        onChange={remoteMonitorBarEnabled => {
          store.setConfig({ remoteMonitorBarEnabled })
        }}
      />
      <Select
        aria-label={e('remoteMonitorBar')}
        allowClear
        className='remote-monitor-item-select'
        mode='multiple'
        onChange={remoteMonitorBarItems => {
          store.setConfig({ remoteMonitorBarItems })
        }}
        placeholder={e('remoteMonitorBar')}
        popupMatchSelectWidth={false}
        style={{ width: '100%' }}
        value={value}
      >
        {
          REMOTE_MONITOR_ITEM_IDS.map(id => {
            return (
              <Option key={id} value={id}>
                {e(id)}
              </Option>
            )
          })
        }
      </Select>
    </section>
  )
}
