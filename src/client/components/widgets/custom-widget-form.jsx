/**
 * Config-mode user widget panel.
 *
 * A user widget without `electerm.ui` does not ship its own HTML. The host
 * renders the form from its `electerm.configs`, calls `electerm.action`
 * (default "run") in the main process with the form values, and draws whatever
 * the action returns:
 *
 *   {
 *     message?: string,
 *     messageType?: 'info' | 'success' | 'warning' | 'error',
 *     details?: [{ label, value, copy?, secret? }],
 *     table?: {
 *       columns: [{ key, title, copy?, secret? }],
 *       rows: [object],
 *       rowButtons?: [{ label, action, danger? }]
 *     },
 *     buttons?: [{ label, action, danger? }],
 *     openTab?: object            // opened as a new terminal tab
 *   }
 *
 * Row buttons call the action with `(row, values)`, other buttons and the
 * submit call it with `(values)`. A row action's result is stacked on top of
 * the current one so there is always a way back.
 */
import React, { useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Space,
  Table,
  Tooltip
} from 'antd'
import {
  ArrowLeftOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { safeGetItemJSON, safeSetItemJSON } from '../../common/safe-local-storage'
import { copy } from '../../common/clipboard'
import message from '../common/message'
import openWidgetTab from './widget-open-tab'
import WidgetAIConfig from './widget-ai-config'
import {
  renderConfigItem,
  configInitialValues
} from './config-fields'

const e = window.translate

function storageKey (id) {
  return `widget-config-${id}`
}

// Only keys the manifest declares are restored: local storage outlives widget
// versions, and a stale row must not become a ghost form value.
function initialValues (info) {
  const defaults = configInitialValues(info.configs)
  if (!info.persist) {
    return defaults
  }
  const saved = safeGetItemJSON(storageKey(info.id || ''), {}) || {}
  const res = { ...defaults }
  info.configs.forEach(config => {
    if (Object.prototype.hasOwnProperty.call(saved, config.name)) {
      res[config.name] = saved[config.name]
    }
  })
  return res
}

function persistValues (info, values) {
  if (!info.persist) {
    return
  }
  const out = {}
  info.configs.forEach(config => {
    // a passphrase must never reach local storage
    if (config.type !== 'password' && Object.prototype.hasOwnProperty.call(values, config.name)) {
      out[config.name] = values[config.name]
    }
  })
  safeSetItemJSON(storageKey(info.id || ''), out)
}

function SecretValue ({ value, revealed, onToggle }) {
  const text = value == null ? '' : String(value)
  return (
    <span className='cwf-secret'>
      <span className='cwf-secret-text elli'>
        {revealed ? text : '•'.repeat(Math.min(text.length || 8, 12))}
      </span>
      <Button
        size='small'
        type='text'
        icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={onToggle}
      />
      <Button
        size='small'
        type='text'
        icon={<CopyOutlined />}
        onClick={() => {
          copy(text)
          message.success(e('copied'))
        }}
      />
    </span>
  )
}

function ResultButtons ({ buttons, busy, onAction }) {
  if (!buttons || !buttons.length) {
    return null
  }
  return (
    <Space wrap className='cwf-buttons'>
      {buttons.map((button, i) => (
        <Button
          key={i}
          size='small'
          danger={!!button.danger}
          type={button.primary ? 'primary' : 'default'}
          disabled={busy}
          onClick={() => onAction(button.action)}
        >
          {button.label}
        </Button>
      ))}
    </Space>
  )
}

function ResultView ({ result, busy, onAction, onBack, canBack }) {
  const [revealed, setRevealed] = useState({})
  if (!result) {
    return null
  }
  const {
    message: msg,
    messageType,
    details,
    table,
    buttons,
    aiConfig
  } = result
  const known = msg || (details && details.length) || (table && table.rows) || (buttons && buttons.length) || aiConfig
  const toggle = (key) => setRevealed(old => ({ ...old, [key]: !old[key] }))

  return (
    <div className='cwf-result'>
      {canBack && (
        <div className='cwf-result-head'>
          <Tooltip title={e('close')}>
            <Button
              size='small'
              type='text'
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
            />
          </Tooltip>
        </div>
      )}
      {msg && (
        <Alert
          type={messageType || 'info'}
          showIcon
          title={msg}
          className='mg1b'
        />
      )}
      {details && details.length > 0 && (
        <div className='cwf-details'>
          {details.map((item, i) => (
            <div className='cwf-detail' key={i}>
              <span className='cwf-detail-label'>{item.label}</span>
              <span className='cwf-detail-value'>
                {item.secret
                  ? (
                    <SecretValue
                      value={item.value}
                      revealed={!!revealed['d' + i]}
                      onToggle={() => toggle('d' + i)}
                    />
                    )
                  : (
                    <>
                      <span className='elli' title={String(item.value == null ? '' : item.value)}>
                        {String(item.value == null ? '' : item.value)}
                      </span>
                      {item.copy && (
                        <Button
                          size='small'
                          type='text'
                          icon={<CopyOutlined />}
                          onClick={() => {
                            copy(String(item.value == null ? '' : item.value))
                            message.success(e('copied'))
                          }}
                        />
                      )}
                    </>
                    )}
              </span>
            </div>
          ))}
        </div>
      )}
      {table && (
        <Table
          className='cwf-table'
          size='small'
          rowKey={(row, i) => row.id || i}
          pagination={table.rows.length > 20 ? { pageSize: 20 } : false}
          dataSource={table.rows || []}
          columns={(table.columns || []).map((column, ci) => ({
            title: column.title || column.key,
            dataIndex: column.key,
            key: column.key || ci,
            ellipsis: true,
            render: (value) => {
              if (column.secret) {
                return (
                  <SecretValue
                    value={value}
                    revealed={!!revealed['c' + ci + ':' + String(value)]}
                    onToggle={() => toggle('c' + ci + ':' + String(value))}
                  />
                )
              }
              return (
                <span className='cwf-cell'>
                  <span className='elli' title={String(value == null ? '' : value)}>
                    {String(value == null ? '' : value)}
                  </span>
                  {column.copy && value != null && (
                    <Button
                      size='small'
                      type='text'
                      icon={<CopyOutlined />}
                      onClick={() => {
                        copy(String(value))
                        message.success(e('copied'))
                      }}
                    />
                  )}
                </span>
              )
            }
          })).concat(
            table.rowButtons && table.rowButtons.length
              ? [{
                  title: '',
                  key: '__actions',
                  render: (_, row) => (
                    <Space size={0}>
                      {table.rowButtons.map((button, i) => (
                        <Button
                          key={i}
                          size='small'
                          type='link'
                          danger={!!button.danger}
                          disabled={busy}
                          onClick={() => onAction(button.action, row, true)}
                        >
                          {button.label}
                        </Button>
                      ))}
                    </Space>
                  )
                }]
              : []
          )}
        />
      )}
      <ResultButtons buttons={buttons} busy={busy} onAction={onAction} />
      <WidgetAIConfig aiConfig={aiConfig} store={window.store} />
      {!known && (
        <pre className='cwf-json'>
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function CustomWidgetForm ({ widget }) {
  const { id, info } = widget
  const [form] = Form.useForm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])

  const values = () => {
    const v = form.getFieldsValue()
    persistValues({ ...info, id }, v)
    return v
  }

  const invoke = async (action, args, stack) => {
    if (typeof action !== 'string' || !action) {
      setError('This widget does not name an action for that button')
      return
    }
    setBusy(true)
    setError('')
    try {
      const raw = await window.pre.runGlobalAsync('callWidgetFunc', id, action, ...args)
      const result = raw && typeof raw === 'object' ? { ...raw } : { message: String(raw == null ? '' : raw) }
      if (result.openTab) {
        const tab = result.openTab
        delete result.openTab
        openWidgetTab(id, tab)
        if (!result.message && !result.details && !result.table && !result.buttons) {
          result.message = e('Done')
          result.messageType = 'success'
        }
      }
      setResults(old => stack === 'push' ? [...old, result] : [result])
    } catch (err) {
      console.error(`widget ${id} action ${action} failed`, err)
      setError(err && err.message ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const submit = async (formValues) => {
    persistValues({ ...info, id }, formValues)
    await invoke(info.action || 'run', [formValues], 'replace')
  }

  const onButton = (action) => invoke(action, [values()], 'replace')
  const onRowButton = (action, row) => invoke(action, [row, values()], 'push')
  const back = () => setResults(old => old.slice(0, -1))

  const result = results.length ? results[results.length - 1] : null

  return (
    <div className='widget-form custom-widget-form'>
      <div className='cwp-head'>
        <div className='cwp-title elli' title={info.description || info.name}>
          {info.name}
          <span className='cwp-version'>{info.version}</span>
        </div>
      </div>
      {info.description && <p className='cwf-desc'>{info.description}</p>}
      <Form
        form={form}
        onFinish={submit}
        initialValues={initialValues({ ...info, id })}
        layout='horizontal'
      >
        {info.configs.map(config => renderConfigItem(config, form))}
        <Form.Item>
          <Button
            type='primary'
            htmlType='submit'
            loading={busy}
          >
            {info.submitLabel || e('submit')}
          </Button>
        </Form.Item>
      </Form>
      {error && (
        <Alert
          type='error'
          showIcon
          title={error}
          className='mg1b'
          closable
          onClose={() => setError('')}
        />
      )}
      <ResultView
        result={result}
        busy={busy}
        canBack={results.length > 1}
        onBack={back}
        onAction={(action, row, isRow) => (
          isRow ? onRowButton(action, row) : onButton(action)
        )}
      />
    </div>
  )
}
