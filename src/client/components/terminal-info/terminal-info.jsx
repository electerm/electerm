import { auto } from 'manate/react'
import { useEffect, useState } from 'react'
import TerminalInfoBase from './base'
import MonitorDetails from '../remote-monitor/monitor-details'
import { getInfoPanelItems } from '../remote-monitor/monitor-model'
import { useMonitorDetails } from '../remote-monitor/use-monitor-details'
import { createEmptyMonitorSnapshot } from '../remote-monitor/session-monitor'
import { getRemoteMonitorTab } from '../remote-monitor/visibility'
import { statusMap } from '../../common/constants'
import { runCmd } from '../terminal/terminal-apis'
import resolveLocalInfo from './local-info-resolver'
import './terminal-info.styl'

function LocalSystemInfo ({ pid }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    let active = true
    resolveLocalInfo(pid).then(info => { if (active) setInfo(info) })
    return () => { active = false }
  }, [pid])
  if (!info) return null
  const snapshot = createEmptyMonitorSnapshot(pid)
  snapshot.groups.sysinfo = { status: 'ready', data: info }
  return <MonitorDetails id='hostname' snapshot={snapshot} config={{}} tab={{}} />
}

function RemoteInfo ({ tab, config }) {
  const items = getInfoPanelItems(config.terminalInfos)
  const { snapshot, levels } = useMonitorDetails(tab.id, items, tab.status === statusMap.success)
  return items.map(id => (
    <MonitorDetails
      key={id}
      id={id}
      snapshot={snapshot}
      levels={levels}
      tab={tab}
      config={config}
      includeActivity={false}
      onKillProcess={pid => runCmd(tab.id, `kill ${pid}`)}
    />
  ))
}

export default auto(function TerminalInfo ({ store, ...props }) {
  const tab = getRemoteMonitorTab(store)
  if (store.rightPanelTab !== 'info' || props.pid !== tab?.id) return null
  const config = store.config
  return (
    <>
      <TerminalInfoBase {...props} terminalInfos={config.terminalInfos} />
      {props.isRemote
        ? <RemoteInfo key={tab.id} tab={tab} config={config} />
        : <LocalSystemInfo key={tab.id} pid={tab.id} />}
    </>
  )
})
