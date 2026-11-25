import { useEffect, useRef, useState } from 'react'
import { Button, Form, Modal, Popover, Tooltip } from 'antd'
import { ApiOutlined, PlusOutlined } from '@ant-design/icons'
import SshTunnelForm, { defaultInitialValues } from '../bookmark-form/common/ssh-tunnel-form'
import formatSshTunnel from '../../common/format-ssh-tunnel'
import { manageSshTunnel } from '../terminal/terminal-apis'

const e = window.translate

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
      setError(err.message)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  function onOpenChange (value) {
    setOpen(value)
    if (value) request('list')
  }

  const title = e('sshTunnel')
  const panel = (
    <div className='ssh-tunnel-panel'>
      {results.map(({ id, sshTunnel, status, error, temporary }) => {
        const running = status === 'running'
        return (
          <div className='ssh-tunnel-row' key={id}>
            <div>
              {sshTunnel.name && <strong>{sshTunnel.name}<br /></strong>}
              {formatSshTunnel(sshTunnel)}
              <div className='font12'>
                {status && e(status)}{temporary && ` · ${e('temporary')}`}
              </div>
              {error && <div role='alert' className='color-red'>{error}</div>}
            </div>
            <Button
              size='small'
              disabled={busy || status === 'starting' || status === 'stopping'}
              onClick={() => request(running ? 'stop' : 'start', { tunnelId: id })}
            >
              {e(running ? 'stop' : 'start')}
            </Button>
          </div>
        )
      })}
      {!results.length && !error && <p>{busy ? e('loading') : e('No tunnels for this connection.')}</p>}
      {error && <p role='alert' className='color-red'>{error}</p>}
      {adding
        ? (
          <>
            <SshTunnelForm
              formChild={form}
              initialValues={defaultInitialValues}
              onFinish={tunnel => request('add', { tunnel })}
              submitLabel={e('Start temporary tunnel')}
              disabled={busy}
            />
            <Button size='small' disabled={busy} onClick={() => setAdding(false)}>{e('cancel')}</Button>
          </>
          )
        : (
          <Button size='small' icon={<PlusOutlined />} disabled={busy} onClick={() => setAdding(true)}>
            {e('Add temporary tunnel')}
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
