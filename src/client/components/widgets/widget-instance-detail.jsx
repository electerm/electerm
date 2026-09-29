/**
 * Detail view for a widget instance: what it is, and what it has been doing.
 *
 * Shown in the right column of the widgets panel (Settings -> Widgets) when an
 * instance is picked from the "Running instances" list, in place of the run
 * form. The instance keeps this panel after it stops — being able to read the
 * log of an instance that died is the whole point of it.
 *
 * Both panes come out of the instance's log file (see
 * app/widgets/instance-log.js): on open, and again whenever Reload is pressed.
 * Deliberately not on a timer — a log that scrolls under you is harder to read
 * than one you refresh when you are ready.
 *
 * The strings here are English: the keys this panel needs do not exist yet, and
 * a new key only reaches the app through an electerm-locales release plus a dep
 * bump (see the locales notes). `e()` is used only for keys that do exist.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Popconfirm,
  Segmented,
  Space,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  ReloadOutlined,
  StopOutlined
} from '@ant-design/icons'
import { auto } from 'manate/react'
import { copy } from '../../common/clipboard'
import parseWidgetLog from '../../common/parse-widget-log'
import './widgets.styl'

const e = window.translate

const SECRET_KEY = /password|passwd|secret|token|apikey|api_key/i
const CONN_MARK = { ok: '✓', fail: '✗', info: '•' }

function pad (n, len = 2) {
  return String(n).padStart(len, '0')
}

function formatTime (ts) {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

// the URL of a widget that needs credentials carries them; the panel gets
// screenshotted, so hide the password here (copy still copies the real one)
function maskUrl (url) {
  return String(url || '').replace(/\/\/([^:/@]+):([^@/]+)@/, '//$1:••••••@')
}

function displayValue (key, value) {
  if (SECRET_KEY.test(key)) {
    return value ? '••••••' : ''
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return value === undefined || value === null ? '' : String(value)
}

export default auto(function WidgetInstanceDetail ({ instance, store }) {
  const [pane, setPane] = useState('log')
  const [data, setData] = useState({ logs: [], events: [] })
  // which confirm popup is open ('' | 'clear' | 'stop'), so its tooltip can
  // step aside — both are anchored to the same button, and the tooltip would
  // otherwise sit on top of the confirm button and swallow the click
  const [confirming, setConfirming] = useState('')
  const [status, setStatus] = useState({
    loaded: false,
    loading: false,
    exists: true,
    error: ''
  })
  const paneRef = useRef(null)

  const running = store.widgetInstances.some(w => w.id === instance.id)
  const logPath = store.widgetLogPath && window.reqs?.path?.join
    ? window.reqs.path.join(store.widgetLogPath, `${instance.id}.log`)
    : ''

  const readLog = useCallback(async () => {
    if (!logPath) {
      setStatus({ loaded: true, loading: false, exists: false, error: '' })
      return
    }
    setStatus(s => ({ ...s, loading: true }))
    try {
      // read straight through: fs/promises has no `exists`, and the bridge
      // rejects unknown helpers — so a missing file is detected from ENOENT
      // rather than probed for, which also saves a round trip
      const text = await window.fs.readFile(logPath)
      setData(parseWidgetLog(text))
      setStatus({ loaded: true, loading: false, exists: true, error: '' })
    } catch (err) {
      const msg = (err && err.message) || String(err)
      if (/ENOENT|no such file/i.test(msg)) {
        // the normal first state of a fresh instance, not a failure
        setData({ logs: [], events: [] })
        setStatus({ loaded: true, loading: false, exists: false, error: '' })
        return
      }
      setStatus({ loaded: true, loading: false, exists: true, error: msg })
    }
  }, [logPath])

  useEffect(() => {
    readLog()
  }, [readLog])

  // newest entry is at the bottom, so land there after every load
  useEffect(() => {
    const el = paneRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [data, pane])

  const clearLog = async () => {
    if (!logPath) {
      return
    }
    try {
      // the bridge resolves false instead of rejecting when the write fails
      const ok = await window.fs.writeFile(logPath, '')
      if (ok === false) {
        throw new Error('could not write ' + logPath)
      }
      setData({ logs: [], events: [] })
      setStatus(s => ({ ...s, exists: true, error: '' }))
    } catch (err) {
      setStatus(s => ({ ...s, error: err.message || String(err) }))
    }
  }

  // Stopping is the one log change the user causes directly, so refresh after
  // it — that is not the polling the panel is avoiding, it is the panel
  // agreeing with the button that was just pressed.
  const stopInstance = async () => {
    await store.stopWidget(instance.id)
    readLog()
  }

  const infoItems = [
    {
      key: 'widget',
      label: 'Widget',
      children: instance.widgetId
    },
    {
      key: 'instance',
      label: 'Instance',
      children: <span className='wil-mono'>{instance.id}</span>
    },
    {
      key: 'status',
      label: 'Status',
      children: running ? <Tag color='green'>running</Tag> : <Tag>stopped</Tag>
    }
  ]
  if (instance.serverInfo && instance.serverInfo.url) {
    infoItems.push({
      key: 'url',
      label: 'URL',
      children: (
        <span className='wil-mono' title={maskUrl(instance.serverInfo.url)}>
          {maskUrl(instance.serverInfo.url)}
        </span>
      )
    })
  }
  if (instance.serverInfo && instance.serverInfo.path) {
    infoItems.push({
      key: 'path',
      label: 'Path',
      children: <span className='wil-mono'>{instance.serverInfo.path}</span>
    })
  }
  if (instance.startedAt) {
    infoItems.push({
      key: 'startedAt',
      label: 'Started',
      children: new Date(instance.startedAt).toLocaleString()
    })
  }
  for (const key of Object.keys(instance.config || {})) {
    if (key === 'autoRun') {
      continue
    }
    infoItems.push({
      key: 'config-' + key,
      label: key,
      children: <span className='wil-mono'>{displayValue(key, instance.config[key])}</span>
    })
  }

  let emptyText = 'Nothing logged yet. Press reload after the widget has been used.'
  if (!logPath) {
    emptyText = 'The widget log directory is not available in this environment.'
  } else if (!status.exists) {
    emptyText = 'No log file yet — this instance has not written anything.'
  }

  const renderPane = () => {
    const isLog = pane === 'log'
    const entries = isLog ? data.logs : data.events
    return (
      <>
        {
          status.error
            ? (
              <Alert
                className='mg1y'
                type='error'
                showIcon
                message={status.error}
              />
              )
            : null
        }
        <div className='wil-pane' ref={paneRef}>
          {entries.map((entry, i) => {
            const state = isLog
              ? entry.level
              : (entry.ok === null ? 'info' : (entry.ok ? 'ok' : 'fail'))
            return (
              <div
                key={i}
                className={'wil-line wil-' + state}
              >
                <span
                  className='wil-time'
                  title={new Date(entry.ts).toISOString()}
                >
                  {formatTime(entry.ts)}
                </span>
                {isLog
                  ? null
                  : <span className='wil-mark'>{CONN_MARK[state]}</span>}
                {isLog ? null : <span className='wil-type'>{entry.type}</span>}
                {isLog || !entry.from
                  ? null
                  : <span className='wil-from'>{entry.from}</span>}
                <span className='wil-msg'>{entry.msg}</span>
              </div>
            )
          })}
          {entries.length ? null : <div className='wil-empty'>{emptyText}</div>}
        </div>
        {logPath
          ? (
            <div className='wil-path elli' title={logPath}>
              Log file: {logPath}
            </div>
            )
          : null}
      </>
    )
  }

  return (
    <div className='widget-instance-detail'>
      <div className='wil-head'>
        <Typography.Text
          strong
          ellipsis
          className='wil-head-title'
          title={instance.title}
        >
          {instance.title}
        </Typography.Text>
        <Space size={4}>
          <Tooltip title='Reload log'>
            <Button
              size='small'
              icon={<ReloadOutlined />}
              loading={status.loading}
              onClick={readLog}
            />
          </Tooltip>
          {instance.serverInfo && instance.serverInfo.url
            ? (
              <Tooltip title='Copy URL'>
                <Button
                  size='small'
                  icon={<CopyOutlined />}
                  onClick={() => copy(instance.serverInfo.url)}
                />
              </Tooltip>
              )
            : null}
          {logPath
            ? (
              <Popconfirm
                title='Clear this instance log?'
                okText='Clear'
                cancelText={e('cancel')}
                onOpenChange={open => setConfirming(open ? 'clear' : '')}
                onConfirm={clearLog}
              >
                <Tooltip title='Clear log' open={confirming === 'clear' ? false : undefined}>
                  <Button size='small' icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
              )
            : null}
          {running
            ? (
              <Popconfirm
                title='Stop this widget?'
                okText='Stop'
                cancelText={e('cancel')}
                onOpenChange={open => setConfirming(open ? 'stop' : '')}
                onConfirm={stopInstance}
              >
                <Tooltip title='Stop' open={confirming === 'stop' ? false : undefined}>
                  <Button
                    size='small'
                    danger
                    icon={<StopOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
              )
            : (
              <Button
                size='small'
                onClick={() => store.closeWidgetInstance()}
              >
                Back
              </Button>
              )}
        </Space>
      </div>
      <Descriptions
        className='wil-descriptions'
        size='small'
        bordered
        column={1}
        items={infoItems}
      />
      <Segmented
        className='wil-switch'
        size='small'
        value={pane}
        onChange={setPane}
        options={[
          {
            label: `Running log (${data.logs.length})`,
            value: 'log'
          },
          {
            label: `Connections (${data.events.length})`,
            value: 'conn'
          }
        ]}
      />
      {renderPane()}
    </div>
  )
})
