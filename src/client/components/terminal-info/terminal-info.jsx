import { auto } from 'manate/react'
import { useEffect, useState } from 'react'
import TerminalInfoBase from './base'
import MonitorDetails from '../remote-monitor/monitor-details'
import { getInfoPanelItems } from '../remote-monitor/monitor-model'
import { useMonitorDetails } from '../remote-monitor/use-monitor-details'
import { createEmptyMonitorSnapshot } from '../remote-monitor/session-monitor'
import { getRemoteMonitorTab } from '../remote-monitor/visibility'
import { useCustomWatchers } from '../remote-monitor/custom-watcher-pool'
import { normalizeWatchers, watcherDetailMap } from '../../common/custom-watcher'
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

function RemoteInfo ({ tab, config, watchers: allWatchers }) {
  const items = getInfoPanelItems(config.terminalInfos)
  const connected = tab.status === statusMap.success
  const { snapshot, levels } = useMonitorDetails(tab.id, items, connected)
  // watchers come with the bookmark, so they are always part of this session's
  // panel and sit after the sections the user picked in the filter
  const watchers = allWatchers.filter(watcher => watcher.enabled)
  const states = useCustomWatchers(tab.id, watchers, connected)
  const customWatchers = watcherDetailMap(watchers, states)
  return [...items, ...watchers.map(watcher => watcher.id)].map(id => (
    <MonitorDetails
      key={id}
      id={id}
      snapshot={snapshot}
      levels={levels}
      tab={tab}
      config={config}
      customWatchers={customWatchers}
      includeActivity={false}
      onKillProcess={pid => runCmd(tab.id, `kill ${pid}`)}
    />
  ))
}

export default auto(function TerminalInfo ({ store, ...props }) {
  const tab = getRemoteMonitorTab(store)
  if (store.rightPanelTab !== 'info' || props.pid !== tab?.id) return null
  const config = store.config
  // read here, not in the children, so a toggle from either filter control
  // re-renders the panel: the watchers belong to the tab
  const watchers = normalizeWatchers(tab.watchers)
  return (
    <>
      <TerminalInfoBase
        {...props}
        tab={tab}
        terminalInfos={config.terminalInfos}
        watchers={watchers}
      />
      {props.isRemote
        ? <RemoteInfo key={tab.id} config={config} tab={tab} watchers={watchers} />
        : <LocalSystemInfo key={tab.id} pid={tab.id} />}
    </>
  )
})
