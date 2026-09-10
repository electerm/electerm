import { Button, Popconfirm } from 'antd'
import { CloseCircleOutlined, BarChartOutlined } from '@ant-design/icons'
import { formatBytes, formatDuration, formatRate, groupOf, selectPrimaryNetwork, sortDisks } from './monitor-model'
import './monitor-details.styl'

const e = window.translate

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

function DetailTable ({ columns, rows, rowKey }) {
  return (
    <div className='remote-monitor-table-wrap'>
      <table className='remote-monitor-table'>
        <thead>
          <tr>{columns.map(column => <th className={column.className} key={column.key}>{column.title}</th>)}</tr>
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
                      <td className={column.className} key={column.key} title={title}>
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
                      className: 'remote-monitor-kill-cell',
                      title: '',
                      value: row => (
                        <Popconfirm title={`${e('close')} pid: ${row.pid}?`} onConfirm={() => onKillProcess(row.pid)}>
                          <Button size='small' type='text' icon={<CloseCircleOutlined />} aria-label={`${e('close')} ${row.pid}`} />
                        </Popconfirm>
                      )
                    }]
                  : []),
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
    { key: 'name', title: e('interface'), value: row => row.name === primary?.name ? `${row.name} *` : row.name },
    ...directions.flatMap(direction => {
      const upload = direction === 'upload'
      return [
        { key: direction, title: e(direction), value: row => formatRate(upload ? row.txRate : row.rxRate) },
        { key: `${direction}-total`, title: upload ? e('sent') : e('received'), value: row => formatBytes(upload ? row.txBytes : row.rxBytes) }
      ]
    })
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
                  { key: 'user', title: e('users'), value: row => row.user },
                  { key: 'terminal', title: 'TTY', value: row => row.terminal || '—' },
                  { key: 'time', title: e('sessions'), value: row => row.loginTime || '—' },
                  ...(!hideIP ? [{ key: 'source', title: e('address'), value: row => row.source || '—' }] : [])
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

export default function MonitorDetails ({ id, snapshot, tab, config, levels, onClose, includeActivity = true, onKillProcess }) {
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
}
