import { useMemo } from 'react'
import { MONITOR_ITEM_GROUP } from './monitor-model'
import { useRemoteMonitor } from './session-monitor'

export function useMonitorDetails (sessionId, items, enabled) {
  const itemsKey = items.join(',')
  const groups = useMemo(() => [...new Set(items.map(id => MONITOR_ITEM_GROUP[id]).filter(Boolean))], [itemsKey])
  const snapshot = useRemoteMonitor(sessionId, groups, enabled)
  return { snapshot, levels: snapshot.levels }
}
