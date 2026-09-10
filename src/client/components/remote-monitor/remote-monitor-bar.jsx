import { auto } from 'manate/react'
import { Button, Popover } from 'antd'
import {
  CloseOutlined,
  SettingOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { settingMap, settingCommonId, statusMap } from '../../common/constants'
import {
  formatBytes,
  groupOf,
  sortDisks,
  MONITOR_ITEM_GROUP,
  formatRate,
  normalizeRemoteMonitorItems,
  selectPrimaryNetwork
} from './monitor-model'
import { useMonitorDetails } from './use-monitor-details'
import MonitorDetails, { Sparkline } from './monitor-details'
import { getRemoteMonitorTab, isRemoteMonitorBarVisible } from './visibility'
import { runCmd } from '../terminal/terminal-apis'
import './remote-monitor-bar.styl'

const e = window.translate

function severity (level) {
  return {
    unknown: -1,
    normal: 0,
    warning: 1,
    critical: 2
  }[level] ?? -1
}

function combineLevel (levels) {
  return levels.reduce((current, level) => {
    return severity(level) > severity(current) ? level : current
  }, 'unknown')
}

function statusMarker (level) {
  if (level !== 'warning' && level !== 'critical') {
    return null
  }
  return (
    <WarningOutlined
      aria-hidden='true'
      className={`remote-monitor-status-marker remote-monitor-level-${level}`}
    />
  )
}

function statusText (level) {
  if (level === 'critical') return e('critical')
  if (level === 'warning') return e('warning')
  if (level === 'unknown') return e('unknown')
  return e('normal')
}

function compactDuration (seconds) {
  const value = Math.max(0, Math.floor(seconds))
  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const secs = value % 60
  if (days) return `${days}d ${String(hours).padStart(2, '0')}h`
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes) return `${minutes}m ${String(secs).padStart(2, '0')}s`
  return `${secs}s`
}

function summaryFor (id, snapshot, levels) {
  if (id === 'hostname') {
    return groupOf(snapshot, 'sysinfo').data?.hostname || '—'
  }
  if (id === 'cpu') {
    const value = groupOf(snapshot, 'cpu').data
    return `CPU ${Number.isFinite(value) ? `${Math.round(value)}%` : '—'}`
  }
  if (id === 'cpuHistory') {
    return <Sparkline history={snapshot.cpuHistory} level={levels.cpu} />
  }
  if (id === 'memory') {
    const memory = groupOf(snapshot, 'memory').data
    return memory
      ? `Mem ${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`
      : 'Mem —'
  }
  if (id === 'upload' || id === 'download') {
    const network = groupOf(snapshot, 'network').data
    const primary = selectPrimaryNetwork(network)
    const rate = id === 'upload' ? primary?.txRate : primary?.rxRate
    return `${id === 'upload' ? '↑' : '↓'} ${formatRate(rate)}`
  }
  if (id === 'uptime') {
    const uptime = groupOf(snapshot, 'uptime').data
    return `Up ${uptime ? compactDuration(uptime.seconds) : '—'}`
  }
  if (id === 'users') {
    const users = groupOf(snapshot, 'users').data?.users
    if (!users) return 'Users —'
    if (!users.length) return 'Users 0'
    return users.length > 1 ? `${users[0]} +${users.length - 1}` : users[0]
  }
  if (id === 'disks') {
    const disks = sortDisks(groupOf(snapshot, 'disks').data)
    if (!disks.length) return 'Disk —'
    const shown = disks.slice(0, 3)
    const groupReady = groupOf(snapshot, 'disks').status === 'ready'
    return (
      <span className='remote-monitor-disk-summary'>
        {
          shown.map(disk => {
            const level = groupReady
              ? levels.disks[disk.mount] || 'unknown'
              : 'unknown'
            return (
              <span
                className={`remote-monitor-disk-value remote-monitor-level-${level}`}
                key={disk.mount}
              >
                {disk.mount}:{disk.percent}%
              </span>
            )
          })
        }
        {disks.length > shown.length ? <span>+{disks.length - shown.length}</span> : null}
      </span>
    )
  }
  return '—'
}

function accessibleSummaryFor (id, summary, snapshot) {
  if (typeof summary === 'string' || typeof summary === 'number') {
    return String(summary)
  }
  if (id === 'cpuHistory') {
    const latest = snapshot.cpuHistory[snapshot.cpuHistory.length - 1]?.value
    return Number.isFinite(latest) ? `${Math.round(latest)}%` : '—'
  }
  if (id === 'disks') {
    const disks = sortDisks(groupOf(snapshot, 'disks').data)
    if (!disks.length) return '—'
    const shown = disks.slice(0, 3).map(disk => `${disk.mount}: ${disk.percent}%`)
    return `${shown.join(', ')}${disks.length > shown.length ? `, +${disks.length - shown.length}` : ''}`
  }
  return '—'
}

function levelForItem (id, levels, snapshot) {
  const group = groupOf(snapshot, MONITOR_ITEM_GROUP[id])
  if (group.status !== 'ready') {
    return 'unknown'
  }
  if (id === 'cpu' || id === 'cpuHistory') return levels.cpu
  if (id === 'memory') return levels.memory
  if (id === 'disks') return combineLevel(Object.values(levels.disks))
  if (id === 'upload' || id === 'download') {
    const primary = selectPrimaryNetwork(group.data)
    const rate = id === 'upload' ? primary?.txRate : primary?.rxRate
    return Number.isFinite(rate) ? 'normal' : 'unknown'
  }
  return group.data === null || group.data === undefined ? 'unknown' : 'normal'
}

export default auto(function RemoteMonitorBar ({ store, style }) {
  const visible = isRemoteMonitorBarVisible(store)
  const config = store.config
  const tab = getRemoteMonitorTab(store) || {}
  const itemsKey = JSON.stringify(config.remoteMonitorBarItems)
  const items = useMemo(
    () => normalizeRemoteMonitorItems(config.remoteMonitorBarItems),
    [itemsKey]
  )
  const enabledItems = items.filter(item => item.enabled)
  const [openId, setOpenId] = useState(null)
  const [pinnedId, setPinnedId] = useState(null)
  const connected = visible && tab.status === statusMap.success
  const requestedItems = enabledItems.map(item => item.id)
  if (openId === 'cpu' || openId === 'memory') requestedItems.push('activities')
  const { snapshot, levels } = useMonitorDetails(tab.id || '', requestedItems, connected)

  useEffect(() => {
    setOpenId(null)
    setPinnedId(null)
  }, [tab.id, itemsKey, visible])

  if (!visible) {
    return null
  }

  function handleOpenChange (id, open) {
    if (open) {
      setOpenId(id)
      if (pinnedId && pinnedId !== id) {
        setPinnedId(null)
      }
    } else if (pinnedId !== id) {
      setOpenId(current => current === id ? null : current)
    }
  }

  function handleClick (id) {
    if (pinnedId === id) {
      setPinnedId(null)
      setOpenId(null)
    } else {
      setPinnedId(id)
      setOpenId(id)
    }
  }

  function closePopover () {
    setPinnedId(null)
    setOpenId(null)
  }

  function openSettings () {
    store.settingTab = settingMap.setting
    store.setSettingItem({
      id: settingCommonId,
      title: e('remoteMonitorBar')
    })
    store.openSettingModal()
    store.settingMobileView = 'content'
  }

  const connectionMessage = tab.status === statusMap.error
    ? e('disconnected')
    : e('loading')

  return (
    <div
      aria-label={e('remoteMonitorBar')}
      className='remote-monitor-bar'
      onKeyDown={event => {
        if (event.key === 'Escape') {
          closePopover()
        }
      }}
      role='region'
      style={style}
    >
      <div className='remote-monitor-scroll'>
        {
          connected
            ? enabledItems.length
              ? enabledItems.map(item => {
                const level = levelForItem(item.id, levels, snapshot)
                const classLevel = item.id === 'disks' && level !== 'unknown'
                  ? 'normal'
                  : level
                const label = e(item.id)
                const summary = summaryFor(item.id, snapshot, levels)
                const accessibleSummary = accessibleSummaryFor(item.id, summary, snapshot)
                return (
                  <Popover
                    autoAdjustOverflow
                    content={(
                      <MonitorDetails
                        config={config}
                        id={item.id}
                        levels={levels}
                        onClose={closePopover}
                        onKillProcess={pid => runCmd(tab.id, `kill ${pid}`)}
                        snapshot={snapshot}
                        tab={tab}
                      />
                    )}
                    key={item.id}
                    mouseEnterDelay={0.2}
                    mouseLeaveDelay={0.15}
                    onOpenChange={open => handleOpenChange(item.id, open)}
                    open={openId === item.id}
                    placement='top'
                    trigger={['hover', 'focus']}
                  >
                    <button
                      aria-label={`${label}: ${accessibleSummary}; ${statusText(level)}`}
                      className={`remote-monitor-item remote-monitor-item-${item.id} remote-monitor-level-${classLevel}`}
                      data-monitor-item={item.id}
                      onClick={() => handleClick(item.id)}
                      title={label}
                      type='button'
                    >
                      {statusMarker(level)}
                      {summary}
                    </button>
                  </Popover>
                )
              })
              : <div className='remote-monitor-message'>{e('noItems')}</div>
            : <div className='remote-monitor-message'>{connectionMessage}</div>
        }
      </div>
      <div className='remote-monitor-controls'>
        <Button
          aria-label={e('configure')}
          icon={<SettingOutlined />}
          onClick={openSettings}
          size='small'
          title={e('configure')}
          type='text'
        />
        <Button
          aria-label={e('close')}
          icon={<CloseOutlined />}
          onClick={() => store.setConfig({ remoteMonitorBarEnabled: false })}
          size='small'
          title={e('close')}
          type='text'
        />
      </div>
    </div>
  )
})
