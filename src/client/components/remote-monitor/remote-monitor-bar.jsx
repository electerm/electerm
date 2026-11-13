import { auto } from 'manate/react'
import { Button, Popover } from 'antd'
import {
  CloseOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { statusMap } from '../../common/constants'
import {
  formatBytes,
  groupOf,
  sortDisks,
  MONITOR_ITEM_GROUP,
  formatRate,
  normalizeRemoteMonitorItems,
  REMOTE_MONITOR_ITEM_IDS,
  selectPrimaryNetwork
} from './monitor-model'
import { useMonitorDetails } from './use-monitor-details'
import MonitorDetails, { Sparkline } from './monitor-details'
import { getRemoteMonitorTab, isRemoteMonitorBarVisible } from './visibility'
import { runCmd } from '../terminal/terminal-apis'
import ItemFilter from '../common/item-filter'
import { useCustomWatchers } from './custom-watcher-pool'
import {
  normalizeWatchers,
  watcherBarSummary,
  watcherDetailMap,
  watcherLabels
} from '../../common/custom-watcher'
import { setWatcherEnabled } from './watcher-toggle'
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

// A watcher has no thresholds and no history: it is either producing output or
// it is not.
function watcherLevel (state) {
  if (state && state.status === 'ready') {
    return 'normal'
  }
  return 'unknown'
}

// Disks keep their own colour when they are merely "unknown" (a mount can be
// unreadable without being an alarm), everything else uses its level as is.
function barClassLevel (id, level) {
  if (id === 'disks' && level !== 'unknown') {
    return 'normal'
  }
  return level
}

// Every bar item looks the same to the renderer: a level, a one-line label, the
// summary text and the tooltip. Built-ins and watchers differ only in where
// those come from, so the difference is settled here instead of in the JSX.
function describeBarItem ({ item, watcher, watcherState, snapshot, levels }) {
  if (watcher) {
    return {
      level: watcherLevel(watcherState),
      label: watcher.name,
      summary: watcherBarSummary(watcher, watcherState),
      title: `${watcher.name}: ${watcher.command}`
    }
  }
  const label = e(item.id)
  return {
    level: levelForItem(item.id, levels, snapshot),
    label,
    summary: summaryFor(item.id, snapshot, levels),
    title: label
  }
}

function barMessage (text) {
  return <div className='remote-monitor-message'>{text}</div>
}

function connectionMessageFor (status) {
  if (status === statusMap.error) {
    return e('disconnected')
  }
  return e('loading')
}

export default auto(function RemoteMonitorBar ({ store, style }) {
  const visible = isRemoteMonitorBarVisible(store)
  const config = store.config
  const tab = getRemoteMonitorTab(store) || {}
  const itemsKey = JSON.stringify(config.remoteMonitorBarItems)
  // watchers belong to the bookmark, not to the global item list: they always
  // show for their own session and are edited in the bookmark form. The filter
  // lists every one of them, so a switched-off watcher can be brought back.
  const watchersKey = JSON.stringify(tab.watchers)
  const allWatchers = useMemo(() => normalizeWatchers(tab.watchers), [watchersKey])
  const watchers = allWatchers.filter(watcher => watcher.enabled)
  const items = useMemo(
    () => normalizeRemoteMonitorItems(config.remoteMonitorBarItems),
    [itemsKey]
  )
  const enabledItems = items.filter(item => item.enabled)
  const barItems = [...enabledItems, ...watchers.map(watcher => ({ id: watcher.id }))]
  const watcherById = useMemo(
    () => new Map(allWatchers.map(watcher => [watcher.id, watcher])),
    [allWatchers]
  )
  const filterIds = [...REMOTE_MONITOR_ITEM_IDS, ...allWatchers.map(watcher => watcher.id)]
  const filterLabels = watcherLabels(allWatchers)
  const filterSelected = [
    ...enabledItems.map(item => item.id),
    ...watchers.map(watcher => watcher.id)
  ]
  // watchers run through their own pool: they have no parsing, levels or history
  const watcherStates = useCustomWatchers(tab.id || '', watchers, visible && tab.status === statusMap.success)
  const watcherDetails = useMemo(
    () => watcherDetailMap(watchers, watcherStates),
    [watchersKey, watcherStates]
  )
  const [openId, setOpenId] = useState(null)
  const [pinnedId, setPinnedId] = useState(null)
  // a second, temporary pin: the filter checklist lives in a portal outside this
  // popover, so reaching for it counts as leaving. It must not turn into the
  // click pin, or the popover would stay open after the checklist is closed.
  const [filterPinnedId, setFilterPinnedId] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  // Touch has no hover, so the details popover there is click-driven: a tap
  // toggles it and a tap outside closes it (store.isTouchDevice follows the
  // input the user actually uses, see main.jsx). The hover/pin bookkeeping
  // below is mouse-only.
  const touchMode = !!store.isTouchDevice
  const connected = visible && tab.status === statusMap.success
  const requestedItems = enabledItems.map(item => item.id)
  if (openId === 'cpu' || openId === 'memory') requestedItems.push('activities')
  const { snapshot, levels } = useMonitorDetails(tab.id || '', requestedItems, connected)

  useEffect(() => {
    setOpenId(null)
    setPinnedId(null)
    setFilterPinnedId(null)
  }, [tab.id, itemsKey, watchersKey, visible])

  // keep the controls revealed while the filter popover is open, the popover
  // lives in a portal so hovering it does not keep the bar hovered
  useEffect(() => {
    setFilterOpen(false)
  }, [tab.id, visible])

  if (!visible) {
    return null
  }

  function handleOpenChange (id, open) {
    if (touchMode) {
      // the popover click trigger owns open/close
      if (open) {
        setOpenId(id)
      } else {
        closePopover()
      }
      return
    }
    // either pin keeps the popover open while the pointer is on the portal
    const pinned = pinnedId || filterPinnedId
    if (open) {
      setOpenId(id)
      if (pinned && pinned !== id) {
        setPinnedId(null)
      }
    } else if (pinned !== id) {
      setOpenId(current => current === id ? null : current)
    }
  }

  function handleClick (id) {
    if (touchMode) {
      // click trigger already toggled it, don't toggle twice
      return
    }
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
    setFilterPinnedId(null)
    setOpenId(null)
  }

  function toggleItem (id) {
    // a watcher lives on the bookmark, a built-in item in the global config
    if (watcherById.has(id)) {
      setWatcherEnabled(tab, id)
      return
    }
    const next = items.map(item => (
      item.id === id ? { ...item, enabled: !item.enabled } : item
    ))
    store.setConfig({
      // keep the stored shape in sync with the setting panel: enabled ids only
      remoteMonitorBarItems: next.filter(item => item.enabled).map(item => item.id)
    })
  }

  // Three states, spelled out instead of nested in the JSX: not connected yet,
  // connected with every item filtered out, and the items themselves.
  function renderBarItems () {
    if (!connected) {
      return barMessage(connectionMessageFor(tab.status))
    }
    if (!barItems.length) {
      return barMessage(e('noItems'))
    }
    return barItems.map(item => {
      const watcher = watcherById.get(item.id)
      const { level, label, summary, title } = describeBarItem({
        item,
        watcher,
        watcherState: watcherStates[item.id],
        snapshot,
        levels
      })
      const classLevel = barClassLevel(item.id, level)
      const accessibleSummary = accessibleSummaryFor(item.id, summary, snapshot)
      return (
        <Popover
          autoAdjustOverflow
          content={(
            <MonitorDetails
              config={config}
              customWatchers={watcherDetails}
              id={item.id}
              levels={levels}
              onClose={closePopover}
              onFilterOpen={open => {
                // the filter checklist is a portal outside this popover, so
                // moving to it counts as leaving: hold the popover open while
                // it is there, and drop that hold once it closes so a plain
                // hover-out still closes the popover
                setFilterPinnedId(open ? item.id : null)
              }}
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
          trigger={touchMode ? 'click' : ['hover', 'focus']}
        >
          <button
            aria-label={`${label}: ${accessibleSummary}; ${statusText(level)}`}
            className={`remote-monitor-item remote-monitor-item-${item.id} remote-monitor-level-${classLevel}`}
            data-monitor-item={item.id}
            onClick={() => handleClick(item.id)}
            title={title}
            type='button'
          >
            {statusMarker(level)}
            {summary}
          </button>
        </Popover>
      )
    })
  }

  return (
    <div
      aria-label={e('remoteMonitorBar')}
      className={'remote-monitor-bar' + (filterOpen ? ' remote-monitor-bar-filter-open' : '')}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          closePopover()
        }
      }}
      role='region'
      style={style}
    >
      <div className='remote-monitor-scroll'>
        {renderBarItems()}
      </div>
      <div className='remote-monitor-controls'>
        <ItemFilter
          className='remote-monitor-filter'
          ids={filterIds}
          labels={filterLabels}
          onOpenChange={setFilterOpen}
          onToggle={toggleItem}
          placement='topRight'
          selected={filterSelected}
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
