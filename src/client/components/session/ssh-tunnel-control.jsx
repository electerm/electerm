import { useEffect, useRef, useState } from 'react'
import { Button, Form, Modal, Popover, Spin, Tooltip } from 'antd'
import {
  ApiOutlined,
  LoadingOutlined,
  MinusCircleFilled,
  PlusOutlined
} from '@ant-design/icons'
import SshTunnelForm, { defaultInitialValues } from '../bookmark-form/common/ssh-tunnel-form'
import formatSshTunnel, { sshTunnelStatusText } from '../../common/format-ssh-tunnel'
import { manageSshTunnel } from '../terminal/terminal-apis'

const e = window.translate

// 'starting'/'stopping' live for a moment only and have no locale key: the
// buttons are disabled meanwhile, a spinner says it without words.
function TunnelStatus ({ status }) {
  if (status === 'starting' || status === 'stopping') {
    return <LoadingOutlined />
  }
  return sshTunnelStatusText(status) || null
}

export default function SshTunnelControl ({ tabId, compact, results = [] }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const mounted = useRef(false)
  const [form] = Form.useForm()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function request (command, options = {}) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const sshTunnelResults = await manageSshTunnel(tabId, { command, ...options })
      if (!mounted.current) return
      window.store.updateTab(tabId, { sshTunnelResults })
      if (command === 'add') {
        form.resetFields()
        setAdding(false)
      }
    } catch (err) {
      if (mounted.current) setError(err.message)
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  function onOpenChange (value) {
    setOpen(value)
    if (value) request('list')
  }

  const title = e('sshTunnel')
  const panel = (
    <div className='ssh-tunnel-panel'>
      {results.map(({ id, sshTunnel, status, error }) => {
        const running = status === 'running'
        const changing = status === 'starting' || status === 'stopping'
        return (
          <div className='ssh-tunnel-row' key={id}>
            <div className='ssh-tunnel-desc'>
              {sshTunnel.name && <strong>{sshTunnel.name}<br /></strong>}
              {formatSshTunnel(sshTunnel)}
              <div className='font12'>
                <TunnelStatus status={status} />
              </div>
              {error && <div role='alert' className='color-red'>{error}</div>}
            </div>
            <div className='ssh-tunnel-ops'>
              <Button
                size='small'
                disabled={busy || changing}
                onClick={() => request(running ? 'stop' : 'start', { tunnelId: id })}
              >
                {e(running ? 'stop' : 'start')}
              </Button>
              <Button
                size='small'
                type='text'
                className='ssh-tunnel-remove'
                aria-label={e('close')}
                icon={<MinusCircleFilled />}
                disabled={busy || changing}
                onClick={() => request('remove', { tunnelId: id })}
              />
            </div>
          </div>
        )
      })}
      {!results.length && busy && <p><Spin size='small' /></p>}
      {error && <p role='alert' className='color-red'>{error}</p>}
      {adding
        ? (
          <>
            <SshTunnelForm
              formChild={form}
              initialValues={defaultInitialValues}
              onFinish={tunnel => request('add', { tunnel })}
              submitLabel={e('start')}
              disabled={busy}
            />
            <Button size='small' disabled={busy} onClick={() => setAdding(false)}>{e('cancel')}</Button>
          </>
          )
        : (
          <Button
            size='small'
            className='ssh-tunnel-add'
            icon={<PlusOutlined />}
            disabled={busy}
            onClick={() => setAdding(true)}
          >
            {e('new')} {e('sshTunnel')}
          </Button>
          )}
    </div>
  )
  const trigger = (
    <Button
      type='text'
      size='small'
      className='sess-icon'
      aria-label={title}
      aria-expanded={open}
      icon={<ApiOutlined />}
      onClick={compact ? () => onOpenChange(true) : undefined}
    />
  )
  return compact
    ? (
      <>
        {trigger}
        <Modal open={open} onCancel={() => setOpen(false)} footer={null} title={title}>
          {panel}
        </Modal>
      </>
      )
    : (
      <Popover title={title} content={panel} trigger='click' placement='bottomRight' open={open} onOpenChange={onOpenChange}>
        <Tooltip title={open ? undefined : title}>{trigger}</Tooltip>
      </Popover>
      )
}
