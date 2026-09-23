import { auto } from 'manate/react'
import { Button, Popconfirm, Table } from 'antd'
import { CloseCircleOutlined, BarChartOutlined } from '@ant-design/icons'
import { formatBytes, formatDuration, formatRate, groupOf, selectPrimaryNetwork, sortDisks } from './monitor-model'
import { copy } from '../../common/clipboard'
import './monitor-details.styl'

const e = window.translate

// store.isMobile is the global 600px rule (mobileBreakpoint in ../../common/constants.js),
// used instead of antd's own `responsive` breakpoints so there is a single source of truth.
const desktopOnly = columns => window.store.isMobile ? [] : columns

export function Sparkline ({ history, level = 'normal', large = false }) {
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

// antd Table only contains its own horizontal overflow when `scroll.x` is set: rc-table
// then wraps the content in an overflow-x:auto box and gives the inner table
// `width: x; min-width: 100%`. A *numeric* x (not 'max-content') keeps table-layout:
// fixed, so `ellipsis` columns still truncate and the width-less column soaks up the
// slack — 'max-content' would switch us back to auto layout and let a long process
// command stretch the table instead of ellipsising it.
// Without scroll.x the widest tables (network 460px, disks 452px) blow past the popover
// content box and drag the whole panel — heading and info button included — into a
// horizontal scrollbar. (`.remote-monitor-popover` is sized 488px so its 464px content
// box clears even the network table; scroll.x is the fallback for narrower widths.)
// Columns without a width are the flexible ones; give them a floor so x stays a
// realistic minimum instead of collapsing to just the fixed columns.
const FLEX_COLUMN_MIN_WIDTH = 100

const minTableWidth = columns => columns.reduce(
  (sum, column) => sum + (typeof column.width === 'number' ? column.width : FLEX_COLUMN_MIN_WIDTH),
  0
)

// antd Table gives us column ellipsis and the compact size for free, so no
// hand rolled markup or table css is needed here.
function DetailTable ({ columns, rows, rowKey }) {
  const mergedColumns = columns.map(withCellCopy)
  return (
    <Table
      className='remote-monitor-table'
      columns={mergedColumns}
      dataSource={rows}
      pagination={false}
      rowKey={rowKey}
      scroll={{ x: minTableWidth(mergedColumns) }}
      size='small'
    />
  )
}

// Click a value cell to copy its text. Columns opt in with `copyValue(row)`, so the
// kill button and any other interactive cell stays untouched. `copy`() writes through
// window.pre.writeClipboard and fires the shared `copied` toast on its own.
// A finished text selection wins over the click, so drag selecting inside a cell
// never clobbers the clipboard by accident.
function withCellCopy (column) {
  const { copyValue } = column
  if (!copyValue) {
    return column
  }
  const rest = { ...column }
  delete rest.copyValue
  return {
    ...rest,
    onCell: row => ({
      className: 'remote-monitor-copy-cell',
      onClick: () => {
        if (window.getSelection()?.toString()) {
          return
        }
        copy(String(copyValue(row)))
      }
    })
  }
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

function ActivityDetails ({ group, sortBy, onKillProcess }) {
  const activities = Array.isArray(group.data) ? [...group.data] : []
  activities.sort(sortBy === 'memory'
    ? (a, b) => b.memBytes - a.memBytes || b.cpu - a.cpu
    : (a, b) => b.cpu - a.cpu || b.memBytes - a.memBytes)
  const rows = sortBy ? activities.slice(0, 10) : activities
  return (
    <div className='remote-monitor-activity'>
      {sortBy && <div className='remote-monitor-detail-heading'>{e('activity')}</div>}
      <GroupState group={group} />
      {
        rows.length
          ? (
            <DetailTable
              columns={[
                ...(onKillProcess
                  ? [{
                      key: 'kill',
                      title: '',
                      width: 32,
                      align: 'center',
                      render: (_, row) => (
                        <Popconfirm title={`${e('close')} pid: ${row.pid}?`} onConfirm={() => onKillProcess(row.pid)}>
                          <Button size='small' type='text' icon={<CloseCircleOutlined />} aria-label={`${e('close')} ${row.pid}`} />
                        </Popconfirm>
                      )
                    }]
                  : []),
                { key: 'pid', title: 'PID', dataIndex: 'pid', width: 60, copyValue: row => row.pid },
                ...desktopOnly([{ key: 'user', title: e('users'), dataIndex: 'user', ellipsis: true, width: 64, copyValue: row => row.user }]),
                { key: 'cpu', title: 'CPU', width: 52, render: (_, row) => `${row.cpu}%`, copyValue: row => `${row.cpu}%` },
                { key: 'memory', title: e('memory'), width: 72, render: (_, row) => formatBytes(row.memBytes), copyValue: row => formatBytes(row.memBytes) },
                { key: 'process', title: e('process'), dataIndex: 'cmd', ellipsis: true, copyValue: row => row.cmd }
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

function MemoryDetail ({ snapshot, includeActivity, swapOnly }) {
  const group = groupOf(snapshot, 'memory')
  const memory = group.data
  return (
    <>
      <GroupState group={group} />
      {
        memory
          ? (
            <DetailRows rows={[
              [e('used'), swapOnly ? null : `${formatBytes(memory.usedBytes)} (${memory.percent.toFixed(1)}%)`],
              [e('available'), swapOnly ? null : formatBytes(memory.availableBytes)],
              [e('total'), swapOnly ? null : formatBytes(memory.totalBytes)],
              [e('swap'), memory.swapTotalBytes === null ? null : `${formatBytes(memory.swapUsedBytes)} / ${formatBytes(memory.swapTotalBytes)}`],
              [e('compatibilityMemory'), !swapOnly && memory.compatibilityMode ? e('enabled') : null]
            ]}
            />
            )
          : null
      }
      {includeActivity && <ActivityDetails group={groupOf(snapshot, 'activities')} sortBy='memory' />}
    </>
  )
}

function NetworkDetail ({ snapshot, direction, hideIP }) {
  const group = groupOf(snapshot, 'network')
  const network = group.data
  const primary = selectPrimaryNetwork(network)
  const directions = direction === 'network' ? ['upload', 'download'] : [direction]
  const columns = [
    {
      key: 'name',
      title: e('interface'),
      width: 84,
      ellipsis: true,
      render: (_, row) => row.name === primary?.name ? `${row.name} *` : row.name
    },
    ...(hideIP
      ? []
      : [{
          key: 'address',
          title: e('address'),
          width: 96,
          ellipsis: true,
          render: (_, row) => row.ipv4 || '—'
        }]),
    ...directions.flatMap(direction => {
      const upload = direction === 'upload'
      return [
        {
          key: direction,
          title: e(direction),
          width: 68,
          render: (_, row) => formatRate(upload ? row.txRate : row.rxRate)
        },
        ...desktopOnly([
          {
            key: `${direction}-total`,
            title: upload ? e('sent') : e('received'),
            width: 72,
            render: (_, row) => formatBytes(upload ? row.txBytes : row.rxBytes)
          }
        ])
      ]
    })
  ]
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

function UsersDetail ({ snapshot, hideIP }) {
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
                  { key: 'user', title: e('users'), dataIndex: 'user', ellipsis: true, width: 80 },
                  ...desktopOnly([{ key: 'terminal', title: 'TTY', width: 64, ellipsis: true, render: (_, row) => row.terminal || '—' }]),
                  { key: 'time', title: e('sessions'), width: 116, ellipsis: true, render: (_, row) => row.loginTime || '—' },
                  ...(hideIP
                    ? []
                    : desktopOnly([{ key: 'source', title: e('address'), width: 96, ellipsis: true, render: (_, row) => row.source || '—' }]))
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
                { key: 'mount', title: e('mount'), dataIndex: 'mount', ellipsis: true, width: 72 },
                { key: 'usage', title: e('used'), width: 60, render: (_, row) => <span className={`remote-monitor-level-${levels[row.mount] || 'unknown'}`}>{row.percent}%</span> },
                { key: 'used', title: e('used'), width: 72, ellipsis: true, render: (_, row) => formatBytes(row.usedBytes) },
                ...desktopOnly([{ key: 'available', title: e('available'), width: 76, ellipsis: true, render: (_, row) => formatBytes(row.availableBytes) }]),
                { key: 'total', title: e('total'), width: 72, ellipsis: true, render: (_, row) => formatBytes(row.totalBytes) },
                ...desktopOnly([{ key: 'filesystem', title: e('filesystem'), dataIndex: 'filesystem', ellipsis: true, width: 100 }])
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

// auto so a resize that flips store.isMobile re-renders the columns right away
export default auto(function MonitorDetails ({ id, snapshot, tab, config, levels, onClose, includeActivity = true, onKillProcess }) {
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
          ['Arch', sysInfo.data?.arch],
          ['Shell', [sysInfo.data?.shell, sysInfo.data?.shellVersion].filter(Boolean).join(' ')]
        ]}
        />
      </>
    )
  } else if (id === 'cpu') {
    body = <CpuDetail includeActivity={includeActivity} level={levels.cpu} snapshot={snapshot} />
  } else if (id === 'cpuHistory') {
    body = <CpuDetail level={levels.cpu} snapshot={snapshot} />
  } else if (id === 'memory' || id === 'swap') {
    body = <MemoryDetail snapshot={snapshot} includeActivity={includeActivity} swapOnly={id === 'swap'} />
  } else if (id === 'upload' || id === 'download' || id === 'network') {
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
    body = <UsersDetail snapshot={snapshot} hideIP={config.hideIP} />
  } else if (id === 'activities') {
    body = <ActivityDetails group={groupOf(snapshot, 'activities')} onKillProcess={onKillProcess} />
  } else if (id === 'disks') {
    body = <DisksDetail levels={levels.disks} snapshot={snapshot} />
  }
  return (
    <div
      className={'remote-monitor-details' + (onClose ? ' remote-monitor-popover' : '')}
      data-monitor-detail={id}
      onKeyDown={event => {
        if (onClose && event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className='remote-monitor-detail-heading'>{e(id)}</div>
      {body}
      {onClose && (
        <Button
          icon={<BarChartOutlined />}
          onClick={() => {
            onClose()
            window.store.openInfoPanel()
          }}
          onMouseDown={event => event.preventDefault()}
          size='small'
          type='link'
        >
          {e('info')}
        </Button>
      )}
    </div>
  )
})
