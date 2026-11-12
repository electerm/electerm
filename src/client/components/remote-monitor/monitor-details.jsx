import { createContext, useContext, useState } from 'react'
import { auto } from 'manate/react'
import { Button, Popconfirm, Table } from 'antd'
import { BarChartOutlined, CloseCircleOutlined, DoubleLeftOutlined } from '@ant-design/icons'
import {
  applyTableFilters,
  buildTableFilters,
  commandName,
  formatBytes,
  formatDuration,
  formatRate,
  groupOf,
  selectPrimaryNetwork,
  sortDisks
} from './monitor-model'
import TableFilter from './table-filter'
import { copy } from '../../common/clipboard'
import './monitor-details.styl'

const e = window.translate

// The monitor bar shows these details in a hover popover, and a hover popover
// closes as soon as the pointer leaves it -- which is exactly what happens when
// the user moves from the funnel to the filter checklist, since that checklist
// is a portal outside the popover. The bar subscribes here to keep the popover
// open while the checklist is up; the info panel has no popover and passes
// nothing, so the context defaults to a no-op.
const FilterOpenContext = createContext(null)

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

// A monitor table can hold hundreds of rows (`ps` on a busy server), which turns a
// 488px popover into a very long scroll and re-lays-out every refresh. Cap the
// visible rows and let the user opt into the rest; the cap lives here rather than
// in each detail view so every table behaves the same.
const DEFAULT_MAX_ROWS = 10

// One filter per section, owned by the section rather than by the table, so the
// funnel can sit in the section heading (see DetailHeading) instead of on a row
// of its own. Filtering also has to happen before DetailTable's row cap, or a
// filter would only ever search the first page.
// antd's own `column.filters` is not used: it filters after the cap, and a funnel
// in every 52-96px column of a 464px popover would fight the column titles.
function useTableFilter (columns, rows) {
  const [selected, setSelected] = useState({})
  return {
    groups: buildTableFilters(columns, rows),
    selected,
    handleChange: setSelected,
    rows: applyTableFilters(rows, columns, selected)
  }
}

// The section title, with the filter funnel sitting right beside it.
function DetailHeading ({ title, filter }) {
  const onFilterOpenChange = useContext(FilterOpenContext)
  return (
    <div className='remote-monitor-detail-heading'>
      <span className='remote-monitor-detail-heading-text'>{title}</span>
      {
        filter && filter.groups.length
          ? (
            <TableFilter
              groups={filter.groups}
              onChange={filter.handleChange}
              onOpenChange={onFilterOpenChange}
              selected={filter.selected}
            />
            )
          : null
      }
    </div>
  )
}

// antd Table gives us column ellipsis and the compact size for free, so no
// hand rolled markup or table css is needed here.
function DetailTable ({ columns, rows, rowKey, maxRows = DEFAULT_MAX_ROWS }) {
  const [showAll, setShowAll] = useState(false)
  const mergedColumns = columns.map(toAntdColumn)
  const collapsible = rows.length > maxRows
  const visibleRows = collapsible && !showAll
    ? rows.slice(0, maxRows)
    : rows
  return (
    <>
      <Table
        className='remote-monitor-table'
        columns={mergedColumns}
        dataSource={visibleRows}
        // antd would say "No data" in English here; a dash keeps the filtered
        // empty state language-free, like the sparkline and rate placeholders
        locale={{ emptyText: '—' }}
        pagination={false}
        rowKey={rowKey}
        scroll={{ x: minTableWidth(mergedColumns) }}
        size='small'
      />
      {
        collapsible
          ? (
            <Button
              aria-expanded={showAll}
              aria-label={showAll ? e('showLess') : `${e('showMore')} (${rows.length})`}
              className={'remote-monitor-show-more' + (showAll ? ' remote-monitor-show-more-open' : '')}
              onClick={() => setShowAll(!showAll)}
              size='small'
              type='link'
            >
              {/* DoubleLeftOutlined has no vertical twin in @ant-design/icons, so it is
                  rotated 90deg: `<<` becomes two down chevrons, and -90deg folds them
                  back up when expanded. The number beside it is the hidden row count,
                  which keeps the control language-free. */}
              <DoubleLeftOutlined />
              <span className='remote-monitor-show-more-count'>{rows.length - maxRows}</span>
            </Button>
            )
          : null
      }
    </>
  )
}

// Click a value cell to copy its text. Columns opt in with `copyValue(row)`, so the
// kill button and any other interactive cell stays untouched. `copy`() writes through
// window.pre.writeClipboard and fires the shared `copied` toast on its own.
// A finished text selection wins over the click, so drag selecting inside a cell
// never clobbers the clipboard by accident.
// `filterValue` is ours as well and is stripped here so a column definition stays a
// plain antd column once it reaches the Table.
function toAntdColumn (column) {
  const { copyValue, filterValue, ...rest } = column
  if (!copyValue) {
    return rest
  }
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

function ActivityDetails ({ group, sortBy, onKillProcess, title }) {
  const activities = Array.isArray(group.data) ? [...group.data] : []
  activities.sort(sortBy === 'memory'
    ? (a, b) => b.memBytes - a.memBytes || b.cpu - a.cpu
    : (a, b) => b.cpu - a.cpu || b.memBytes - a.memBytes)
  const columns = [
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
    ...desktopOnly([{ key: 'user', title: e('users'), dataIndex: 'user', ellipsis: true, width: 64, copyValue: row => row.user, filterValue: row => row.user }]),
    { key: 'cpu', title: 'CPU', width: 52, render: (_, row) => `${row.cpu}%`, copyValue: row => `${row.cpu}%` },
    { key: 'memory', title: e('memory'), width: 72, render: (_, row) => formatBytes(row.memBytes), copyValue: row => formatBytes(row.memBytes) },
    { key: 'process', title: e('process'), dataIndex: 'cmd', ellipsis: true, copyValue: row => row.cmd, filterValue: row => commandName(row.cmd) }
  ]
  const filter = useTableFilter(columns, activities)
  // no slice here: DetailTable caps the visible rows and offers "show more",
  // so the top-N list stays short without throwing the rest away
  return (
    <div className='remote-monitor-activity'>
      <DetailHeading title={title} filter={filter} />
      <GroupState group={group} />
      {
        activities.length
          ? (
            <DetailTable
              columns={columns}
              rowKey={row => row.pid}
              rows={filter.rows}
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
      {includeActivity ? <ActivityDetails group={groupOf(snapshot, 'activities')} sortBy='cpu' title={e('activity')} /> : null}
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
      {includeActivity && <ActivityDetails group={groupOf(snapshot, 'activities')} sortBy='memory' title={e('activity')} />}
    </>
  )
}

function NetworkDetail ({ snapshot, direction, hideIP, title }) {
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
      filterValue: row => row.name,
      render: (_, row) => row.name === primary?.name ? `${row.name} *` : row.name
    },
    ...(hideIP
      ? []
      : [{
          key: 'address',
          title: e('address'),
          width: 96,
          ellipsis: true,
          filterValue: row => row.ipv4,
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
  const filter = useTableFilter(columns, network?.interfaces || [])
  return (
    <>
      <DetailHeading title={title} filter={filter} />
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
                rows={filter.rows}
              />
            </>
            )
          : null
      }
    </>
  )
}

function UsersDetail ({ snapshot, hideIP, title }) {
  const group = groupOf(snapshot, 'users')
  const users = group.data
  const columns = [
    { key: 'user', title: e('users'), dataIndex: 'user', ellipsis: true, width: 80, filterValue: row => row.user },
    ...desktopOnly([{ key: 'terminal', title: 'TTY', width: 64, ellipsis: true, render: (_, row) => row.terminal || '—', filterValue: row => row.terminal }]),
    { key: 'time', title: e('sessions'), width: 116, ellipsis: true, render: (_, row) => row.loginTime || '—' },
    ...(hideIP
      ? []
      : desktopOnly([{ key: 'source', title: e('address'), width: 96, ellipsis: true, render: (_, row) => row.source || '—', filterValue: row => row.source }]))
  ]
  const filter = useTableFilter(columns, users?.sessions || [])
  return (
    <>
      <DetailHeading title={title} filter={filter} />
      <GroupState group={group} />
      {
        users
          ? users.sessions.length
            ? (
              <DetailTable
                columns={columns}
                rowKey={row => `${row.user}-${row.terminal}`}
                rows={filter.rows}
              />
              )
            : <div className='remote-monitor-detail-state'>{e('noUsers')}</div>
          : null
      }
    </>
  )
}

function DisksDetail ({ snapshot, levels, title }) {
  const group = groupOf(snapshot, 'disks')
  const disks = sortDisks(group.data)
  const columns = [
    { key: 'mount', title: e('mount'), dataIndex: 'mount', ellipsis: true, width: 72, filterValue: row => row.mount },
    { key: 'usage', title: e('used'), width: 60, render: (_, row) => <span className={`remote-monitor-level-${levels[row.mount] || 'unknown'}`}>{row.percent}%</span> },
    { key: 'used', title: e('used'), width: 72, ellipsis: true, render: (_, row) => formatBytes(row.usedBytes) },
    ...desktopOnly([{ key: 'available', title: e('available'), width: 76, ellipsis: true, render: (_, row) => formatBytes(row.availableBytes) }]),
    { key: 'total', title: e('total'), width: 72, ellipsis: true, render: (_, row) => formatBytes(row.totalBytes) },
    ...desktopOnly([{ key: 'filesystem', title: e('filesystem'), dataIndex: 'filesystem', ellipsis: true, width: 100, filterValue: row => row.filesystem }])
  ]
  const filter = useTableFilter(columns, disks)
  return (
    <>
      <DetailHeading title={title} filter={filter} />
      <GroupState group={group} />
      {
        disks.length
          ? (
            <DetailTable
              columns={columns}
              rowKey={row => `${row.filesystem}-${row.mount}`}
              rows={filter.rows}
            />
            )
          : null
      }
    </>
  )
}

// auto so a resize that flips store.isMobile re-renders the columns right away
export default auto(function MonitorDetails ({ id, snapshot, tab, config, levels, onClose, includeActivity = true, onKillProcess, onFilterOpen }) {
  const sysInfo = groupOf(snapshot, 'sysinfo')
  let body
  // sections with a table render their own heading so the filter funnel can sit
  // on the same line as the title; the rest keep the one rendered below
  let selfTitled = false
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
    selfTitled = true
    body = <NetworkDetail direction={id} hideIP={config.hideIP} snapshot={snapshot} title={e(id)} />
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
    selfTitled = true
    body = <UsersDetail snapshot={snapshot} hideIP={config.hideIP} title={e(id)} />
  } else if (id === 'activities') {
    selfTitled = true
    body = <ActivityDetails group={groupOf(snapshot, 'activities')} onKillProcess={onKillProcess} title={e(id)} />
  } else if (id === 'disks') {
    selfTitled = true
    body = <DisksDetail levels={levels.disks} snapshot={snapshot} title={e(id)} />
  }
  return (
    <FilterOpenContext.Provider value={onFilterOpen}>
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
        {selfTitled ? null : <DetailHeading title={e(id)} />}
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
    </FilterOpenContext.Provider>
  )
})
