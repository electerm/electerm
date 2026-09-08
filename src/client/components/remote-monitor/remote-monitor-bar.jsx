import { auto } from 'manate/react'
import { Button, Popover } from 'antd'
import {
  CloseOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { settingMap, settingCommonId, statusMap } from '../../common/constants'
import {
  formatBytes,
  formatDuration,
  formatRate,
  getUsageLevel,
  normalizeRemoteMonitorItems,
  selectPrimaryNetwork
} from './monitor-model'
import { useRemoteMonitor } from './session-monitor'
import { getRemoteMonitorTab, isRemoteMonitorBarVisible } from './visibility'
import './remote-monitor-bar.styl'

const e = window.translate

const ITEM_GROUP = {
  hostname: 'sysinfo',
  cpu: 'cpu',
  cpuHistory: 'cpu',
  memory: 'memory',
  upload: 'network',
  download: 'network',
  uptime: 'uptime',
  users: 'users',
  disks: 'disks'
}

const DISK_PRIORITY = ['/', '/home', '/var', '/data']

function groupOf (snapshot, name) {
  return snapshot.groups[name] || {
    status: 'idle',
    data: null,
    updatedAt: null,
    error: null
  }
}

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

function useUsageLevels (snapshot) {
  const cpu = groupOf(snapshot, 'cpu').data
  const memory = groupOf(snapshot, 'memory').data
  const disks = groupOf(snapshot, 'disks').data
  const diskSignature = Array.isArray(disks)
    ? disks.map(disk => `${disk.mount}:${disk.percent}`).join('|')
    : ''
  const [levels, setLevels] = useState({
    cpu: 'unknown',
    memory: 'unknown',
    disks: {}
  })

  useEffect(() => {
    setLevels(previous => {
      const nextDisks = {}
      for (const disk of Array.isArray(disks) ? disks : []) {
        nextDisks[disk.mount] = getUsageLevel(
          disk.percent,
          previous.disks[disk.mount]
        )
      }
      return {
        cpu: getUsageLevel(cpu, previous.cpu),
        memory: getUsageLevel(memory?.percent, previous.memory),
        disks: nextDisks
      }
    })
  }, [cpu, memory?.percent, diskSignature])

  return levels
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

function sortDisks (disks) {
  return [...(Array.isArray(disks) ? disks : [])].sort((a, b) => {
    const ai = DISK_PRIORITY.indexOf(a.mount)
    const bi = DISK_PRIORITY.indexOf(b.mount)
    const ar = ai === -1 ? DISK_PRIORITY.length : ai
    const br = bi === -1 ? DISK_PRIORITY.length : bi
    return ar - br || a.mount.localeCompare(b.mount)
  })
}

function Sparkline ({ history, level = 'normal', large = false }) {
  if (!history.length) {
    return <span className='remote-monitor-empty'>—</span>
  }
  const width = large ? 360 : 72
  const height = large ? 88 : 20
  const start = history[0].timestamp
  const end = history[history.length - 1].timestamp
  const span = Math.max(1, end - start)
  const segments = []
  let current = []
  history.forEach((sample, index) => {
    if (index && sample.timestamp - history[index - 1].timestamp > 12000) {
      if (current.length) segments.push(current)
      current = []
    }
    const x = (sample.timestamp - start) * width / span
    const y = height - Math.max(0, Math.min(100, sample.value)) * height / 100
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  })
  if (current.length) segments.push(current)
  return (
    <svg
      aria-label={`${e('cpuHistory')}: ${Math.round(history[history.length - 1].value)}%`}
      className={`remote-monitor-sparkline remote-monitor-level-${level}`}
      height={height}
      role='img'
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {
        segments.map((points, index) => (
          <polyline
            fill='none'
            key={`${points[0]}-${index}`}
            points={points.join(' ')}
            stroke='currentColor'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={large ? 2 : 1.5}
          />
        ))
      }
    </svg>
  )
}

function DetailRows ({ rows }) {
  return (
    <dl className='remote-monitor-detail-rows'>
      {
        rows.filter(row => row[1] !== null && row[1] !== undefined && row[1] !== '').map(row => (
          <div className='remote-monitor-detail-row' key={row[0]}>
            <dt>{row[0]}</dt>
            <dd title={String(row[1])}>{row[1]}</dd>
          </div>
        ))
      }
    </dl>
  )
}

function DetailTable ({ columns, rows, rowKey }) {
  return (
    <div className='remote-monitor-table-wrap'>
      <table className='remote-monitor-table'>
        <thead>
          <tr>{columns.map(column => <th key={column.key}>{column.title}</th>)}</tr>
        </thead>
        <tbody>
          {
            rows.map((row, index) => (
              <tr key={rowKey ? rowKey(row) : index}>
                {
                  columns.map(column => {
                    const value = column.value(row)
                    const title = typeof value === 'string' || typeof value === 'number'
                      ? String(value)
                      : undefined
                    return (
                      <td key={column.key} title={title}>
                        {value}
                      </td>
                    )
                  })
                }
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}

function GroupState ({ group }) {
  if (group.data !== null && group.data !== undefined) {
    if (group.status === 'stale') {
      return (
        <div className='remote-monitor-detail-state remote-monitor-level-warning'>
          {e('stale')}: {new Date(group.updatedAt).toLocaleTimeString()}
        </div>
      )
    }
    return null
  }
  const text = group.status === 'loading' || group.status === 'idle'
    ? e('loading')
    : group.status === 'unsupported'
      ? e('unavailable')
      : group.error || e('unavailable')
  return <div className='remote-monitor-detail-state'>{text}</div>
}

function ActivityDetails ({ group, sortBy }) {
  const activities = Array.isArray(group.data) ? [...group.data] : []
  activities.sort(sortBy === 'memory'
    ? (a, b) => b.memBytes - a.memBytes || b.cpu - a.cpu
    : (a, b) => b.cpu - a.cpu || b.memBytes - a.memBytes)
  const rows = activities.slice(0, 10)
  return (
    <div className='remote-monitor-activity'>
      <div className='remote-monitor-detail-heading'>{e('activity')}</div>
      <GroupState group={group} />
      {
        rows.length
          ? (
            <DetailTable
              columns={[
                { key: 'pid', title: 'PID', value: row => row.pid },
                { key: 'user', title: e('users'), value: row => row.user },
                { key: 'cpu', title: 'CPU', value: row => `${row.cpu}%` },
                { key: 'memory', title: e('memory'), value: row => formatBytes(row.memBytes) },
                { key: 'process', title: e('process'), value: row => row.cmd }
              ]}
              rowKey={row => row.pid}
              rows={rows}
            />
            )
          : null
      }
    </div>
  )
}

function CpuDetail ({ snapshot, includeActivity, level }) {
  const group = groupOf(snapshot, 'cpu')
  const values = snapshot.cpuHistory.map(sample => sample.value)
  const average = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null
  return (
    <>
      <GroupState group={group} />
      {
        Number.isFinite(group.data)
          ? (
            <>
              <DetailRows rows={[
                [e('current'), `${group.data.toFixed(1)}%`],
                [e('average'), average === null ? null : `${average.toFixed(1)}%`],
                [e('minimum'), values.length ? `${Math.min(...values).toFixed(1)}%` : null],
                [e('maximum'), values.length ? `${Math.max(...values).toFixed(1)}%` : null]
              ]}
              />
              <div className='remote-monitor-detail-chart'>
                <Sparkline history={snapshot.cpuHistory} large level={level} />
              </div>
            </>
            )
          : null
      }
      {includeActivity ? <ActivityDetails group={groupOf(snapshot, 'activities')} sortBy='cpu' /> : null}
    </>
  )
}

function MemoryDetail ({ snapshot }) {
  const group = groupOf(snapshot, 'memory')
  const memory = group.data
  return (
    <>
      <GroupState group={group} />
      {
        memory
          ? (
            <DetailRows rows={[
              [e('used'), `${formatBytes(memory.usedBytes)} (${memory.percent.toFixed(1)}%)`],
              [e('available'), formatBytes(memory.availableBytes)],
              [e('total'), formatBytes(memory.totalBytes)],
              [e('swap'), memory.swapTotalBytes === null ? null : `${formatBytes(memory.swapUsedBytes)} / ${formatBytes(memory.swapTotalBytes)}`],
              [e('compatibilityMemory'), memory.compatibilityMode ? e('enabled') : null]
            ]}
            />
            )
          : null
      }
      <ActivityDetails group={groupOf(snapshot, 'activities')} sortBy='memory' />
    </>
  )
}

function NetworkDetail ({ snapshot, direction, hideIP }) {
  const group = groupOf(snapshot, 'network')
  const network = group.data
  const upload = direction === 'upload'
  const primary = selectPrimaryNetwork(network)
  const columns = [
    { key: 'name', title: e('interface'), value: row => row.name === primary?.name ? `${row.name} *` : row.name },
    { key: 'rate', title: upload ? e('upload') : e('download'), value: row => formatRate(upload ? row.txRate : row.rxRate) },
    { key: 'total', title: upload ? e('sent') : e('received'), value: row => formatBytes(upload ? row.txBytes : row.rxBytes) }
  ]
  if (!hideIP) {
    columns.splice(1, 0, {
      key: 'address',
      title: e('address'),
      value: row => row.ipv4 || '—'
    })
  }
  return (
    <>
      <GroupState group={group} />
      {
        network
          ? (
            <>
              <DetailRows rows={[
                [e('primaryInterface'), primary?.name]
              ]}
              />
              <DetailTable
                columns={columns}
                rowKey={row => row.name}
                rows={network.interfaces || []}
              />
            </>
            )
          : null
      }
    </>
  )
}

function UsersDetail ({ snapshot }) {
  const group = groupOf(snapshot, 'users')
  const users = group.data
  return (
    <>
      <GroupState group={group} />
      {
        users
          ? users.sessions.length
            ? (
              <DetailTable
                columns={[
                  { key: 'user', title: e('users'), value: row => row.user },
                  { key: 'terminal', title: 'TTY', value: row => row.terminal || '—' },
                  { key: 'time', title: e('sessions'), value: row => row.loginTime || '—' },
                  { key: 'source', title: e('address'), value: row => row.source || '—' }
                ]}
                rows={users.sessions}
              />
              )
            : <div className='remote-monitor-detail-state'>{e('noUsers')}</div>
          : null
      }
    </>
  )
}

function DisksDetail ({ snapshot, levels }) {
  const group = groupOf(snapshot, 'disks')
  const disks = sortDisks(group.data)
  return (
    <>
      <GroupState group={group} />
      {
        disks.length
          ? (
            <DetailTable
              columns={[
                { key: 'mount', title: e('mount'), value: row => row.mount },
                { key: 'usage', title: e('used'), value: row => <span className={`remote-monitor-level-${levels[row.mount] || 'unknown'}`}>{row.percent}%</span> },
                { key: 'used', title: e('used'), value: row => formatBytes(row.usedBytes) },
                { key: 'available', title: e('available'), value: row => formatBytes(row.availableBytes) },
                { key: 'total', title: e('total'), value: row => formatBytes(row.totalBytes) },
                { key: 'filesystem', title: e('filesystem'), value: row => row.filesystem }
              ]}
              rowKey={row => `${row.filesystem}-${row.mount}`}
              rows={disks}
            />
            )
          : null
      }
    </>
  )
}

function DetailContent ({ id, snapshot, tab, config, levels, onClose }) {
  const sysInfo = groupOf(snapshot, 'sysinfo')
  let body
  if (id === 'hostname') {
    body = (
      <>
        <GroupState group={sysInfo} />
        <DetailRows rows={[
          [e('hostname'), sysInfo.data?.hostname],
          [e('address'), config.hideIP ? null : tab.host],
          ['OS', sysInfo.data?.os],
          ['Kernel', sysInfo.data?.kernel],
          ['Arch', sysInfo.data?.arch]
        ]}
        />
      </>
    )
  } else if (id === 'cpu') {
    body = <CpuDetail includeActivity level={levels.cpu} snapshot={snapshot} />
  } else if (id === 'cpuHistory') {
    body = <CpuDetail level={levels.cpu} snapshot={snapshot} />
  } else if (id === 'memory') {
    body = <MemoryDetail snapshot={snapshot} />
  } else if (id === 'upload' || id === 'download') {
    body = <NetworkDetail direction={id} hideIP={config.hideIP} snapshot={snapshot} />
  } else if (id === 'uptime') {
    const group = groupOf(snapshot, 'uptime')
    body = (
      <>
        <GroupState group={group} />
        {group.data
          ? <DetailRows rows={[
            [e('uptime'), formatDuration(group.data.seconds)],
            [e('bootTime'), group.data.bootTime ? new Date(group.data.bootTime).toLocaleString() : null]
          ]}
            />
          : null}
      </>
    )
  } else if (id === 'users') {
    body = <UsersDetail snapshot={snapshot} />
  } else if (id === 'disks') {
    body = <DisksDetail levels={levels.disks} snapshot={snapshot} />
  }
  return (
    <div
      className='remote-monitor-popover'
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className='remote-monitor-detail-heading'>{e(id)}</div>
      {body}
      <Button
        icon={<InfoCircleOutlined />}
        onClick={() => {
          onClose()
          window.store.openInfoPanel()
        }}
        onMouseDown={event => event.preventDefault()}
        size='small'
        type='link'
      >
        {e('openInfo')}
      </Button>
    </div>
  )
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
  const group = groupOf(snapshot, ITEM_GROUP[id])
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

export default auto(function RemoteMonitorBar ({ store }) {
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
  const groupKey = enabledItems.map(item => item.id).join(',')
  const groups = useMemo(() => {
    const requested = new Set(enabledItems.map(item => ITEM_GROUP[item.id]))
    if (openId === 'cpu' || openId === 'memory') {
      requested.add('activities')
    }
    return [...requested].filter(Boolean)
  }, [groupKey, openId])
  const connected = visible && tab.status === statusMap.success
  const snapshot = useRemoteMonitor(tab.id || '', groups, connected && groups.length > 0)
  const levels = useUsageLevels(snapshot)

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
  }

  const {
    leftSidePanelWidth,
    leftSideBarWidth,
    openedSideBar
  } = store
  const style = openedSideBar
    ? { left: `${leftSidePanelWidth + leftSideBarWidth}px` }
    : undefined
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
                      <DetailContent
                        config={config}
                        id={item.id}
                        levels={levels}
                        onClose={closePopover}
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
