/**
 * bookmark form - "Check host" button for rdp
 *
 * Manual on purpose. A check on every connect costs a ping timeout on the
 * hosts that need it least (windows drops icmp by default) and can be wrong
 * about a slow link, so it runs when the user asks and reports what it saw
 * instead of deciding whether to connect.
 *
 * Registered as field type 'hostCheck' in ./fields.jsx and used by
 * ../config/rdp.js. The work happens in the main process
 * (src/app/lib/check-host.js, exposed as 'checkHost' in ../app/lib/ipc.js).
 */
import { useState } from 'react'
import {
  Form,
  Button,
  Alert
} from 'antd'
import { ApiOutlined } from '@ant-design/icons'
import { tailFormItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item

/**
 * @param {object} r result of checkHost
 * @param {string} host
 * @param {number} port
 * @param {boolean} indirect a proxy or a jump host is configured
 * @return {{type: string, text: string}}
 */
function describe (r, host, port, indirect) {
  const via = indirect
    ? ' (checked from this machine, not through the proxy or jump host)'
    : ''
  if (r.error) {
    return { type: 'error', text: `cannot check ${host}: ${r.error}` }
  }
  if (r.ping) {
    return { type: 'success', text: `${host} answers ping${via}` }
  }
  if (r.port) {
    return {
      type: 'success',
      text: `${host} does not answer ping, but port ${port} accepts connections: ` +
        `windows blocks ping by default, so this is expected${via}`
    }
  }
  return {
    type: 'warning',
    text: `${host} answered neither ping nor port ${port}: the computer may be off ` +
      `or asleep, or a firewall blocks it${via}`
  }
}

export default function HostCheck ({ form }) {
  const [hint, setHint] = useState(null)
  const [loading, setLoading] = useState(false)

  const check = async () => {
    const host = String(form.getFieldValue('host') || '').trim()
    const port = form.getFieldValue('port') || 3389
    if (!host) {
      setHint({ type: 'warning', text: 'no host to check' })
      return
    }
    if (!window.pre?.runGlobalAsync) {
      setHint({ type: 'error', text: 'not available in this version' })
      return
    }
    const indirect = !!(form.getFieldValue('proxy') ||
      form.getFieldValue('connectionHoppings')?.length)
    setLoading(true)
    setHint(null)
    try {
      const r = await window.pre.runGlobalAsync('checkHost', host, port)
      setHint(r ? describe(r, host, port, indirect) : null)
    } catch (err) {
      setHint({ type: 'error', text: `cannot check ${host}: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormItem
      {...tailFormItemLayout}
    >
      <Button
        icon={<ApiOutlined />}
        loading={loading}
        onClick={check}
      >
        Check host
      </Button>
      {
        hint && (
          <Alert
            className='mg1t'
            type={hint.type}
            message={hint.text}
            showIcon
            closable
            onClose={() => setHint(null)}
          />
        )
      }
    </FormItem>
  )
}
