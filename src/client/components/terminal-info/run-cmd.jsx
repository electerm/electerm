/**
 * Subscribe the Info panel to the shared per-session remote monitor sampler.
 */

import { useEffect, useMemo } from 'react'
import {
  formatBytes,
  formatDuration
} from '../remote-monitor/monitor-model'
import { useRemoteMonitor } from '../remote-monitor/session-monitor'

function requestedGroups (terminalInfos) {
  const selected = new Set(Array.isArray(terminalInfos) ? terminalInfos : [])
  const groups = ['sysinfo']
  if (selected.has('uptime')) groups.push('uptime')
  if (selected.has('cpu')) groups.push('cpu')
  if (selected.has('mem') || selected.has('swap')) groups.push('memory')
  if (selected.has('activities')) groups.push('activities')
  if (selected.has('network')) groups.push('network')
  if (selected.has('disks')) groups.push('disks')
  return groups
}

function dataOf (snapshot, name) {
  return snapshot.groups[name]?.data
}

function toInfoState (snapshot) {
  const cpu = dataOf(snapshot, 'cpu')
  const memory = dataOf(snapshot, 'memory')
  const uptime = dataOf(snapshot, 'uptime')
  const network = dataOf(snapshot, 'network')
  const activities = dataOf(snapshot, 'activities')
  const disks = dataOf(snapshot, 'disks')
  const mem = memory
    ? {
        total: formatBytes(memory.totalBytes),
        used: formatBytes(memory.usedBytes),
        free: formatBytes(memory.availableBytes),
        percent: memory.percent
      }
    : {}
  const swap = memory && memory.swapTotalBytes !== null
    ? {
        total: formatBytes(memory.swapTotalBytes),
        used: formatBytes(memory.swapUsedBytes),
        free: formatBytes(memory.swapTotalBytes - memory.swapUsedBytes),
        percent: memory.swapTotalBytes > 0
          ? memory.swapUsedBytes * 100 / memory.swapTotalBytes
          : 0
      }
    : {}
  const networkMap = Object.fromEntries((network?.interfaces || []).map(item => [
    item.name,
    {
      ip: item.ipv4 || '',
      download: item.rxBytes,
      upload: item.txBytes,
      down: item.rxRate,
      up: item.txRate
    }
  ]))
  return {
    uptime: uptime ? formatDuration(uptime.seconds) : '',
    cpu: Number.isFinite(cpu) ? `${cpu.toFixed(1)}%` : '',
    mem,
    swap,
    activities: Array.isArray(activities)
      ? activities.map(item => ({
        pid: item.pid,
        user: item.user,
        cpu: item.cpu,
        mem: formatBytes(item.memBytes),
        cmd: item.cmd
      }))
      : [],
    disks: Array.isArray(disks)
      ? disks.map(item => ({
        filesystem: item.filesystem,
        size: formatBytes(item.totalBytes),
        used: formatBytes(item.usedBytes),
        avail: formatBytes(item.availableBytes),
        usedPercent: `${item.percent}%`,
        mount: item.mount
      }))
      : [],
    network: networkMap,
    sysInfo: dataOf(snapshot, 'sysinfo') || null
  }
}

export default function RunCmd (props) {
  const terminalInfosKey = JSON.stringify(props.terminalInfos || [])
  const groups = useMemo(
    () => requestedGroups(props.terminalInfos),
    [terminalInfosKey]
  )
  const snapshot = useRemoteMonitor(
    props.pid || '',
    groups,
    !!props.isRemote && !!props.pid
  )

  useEffect(() => {
    if (props.isRemote && props.pid) {
      props.setState(toInfoState(snapshot))
    }
  }, [snapshot, props.isRemote, props.pid])

  return null
}
