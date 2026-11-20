/**
 * bookmark form - forget the Windows credential the local RDP client uses
 *
 * mstsc has no password switch, so the launcher stores the bookmark password as
 * a Windows credential and mstsc picks it up by itself (see
 * src/app/lib/native-rdp-win.js). A changed bookmark password overwrites that
 * credential on the next launch, so this button is not about stale passwords --
 * it is how the secret is removed from the machine. Switching a bookmark back to
 * the built-in client leaves the credential behind, which is exactly when it is
 * needed.
 *
 * Registered as field type 'nativeRdpCredential' in ./fields.jsx and used by
 * ../config/rdp.js.
 */
import { useState } from 'react'
import {
  Form,
  Button,
  Alert
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { tailFormItemLayout } from '../../../common/form-layout'
import { canUseNativeRdp } from '../../../common/native-rdp'

const FormItem = Form.Item

export default function NativeRdpCredential ({ form }) {
  const [hint, setHint] = useState(null)
  const [loading, setLoading] = useState(false)

  // Windows desktop only, same condition as the switch that turns the local
  // client on (see ../config/rdp.js)
  if (!canUseNativeRdp()) {
    return null
  }

  const clear = async () => {
    const host = String(form.getFieldValue('host') || '').trim()
    if (!host) {
      setHint({ type: 'warning', text: 'no host to clear a credential for' })
      return
    }
    setLoading(true)
    setHint(null)
    try {
      const results = await window.pre.runGlobalAsync('clearRdpCredential', {
        host,
        port: form.getFieldValue('port')
      })
      const failed = (results || []).filter(r => !r.ok)
      setHint(
        failed.length
          ? { type: 'warning', text: `no saved credential for ${host}: ${failed[0].error}` }
          : { type: 'success', text: `saved credential for ${host} removed` }
      )
    } catch (err) {
      setHint({ type: 'error', text: `cannot clear the credential: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormItem
      {...tailFormItemLayout}
    >
      <Button
        icon={<DeleteOutlined />}
        loading={loading}
        onClick={clear}
      >
        Clear saved Windows credential
      </Button>
      {
        hint && (
          <Alert
            className='mg1t'
            type={hint.type}
            title={hint.text}
            showIcon
            closable
            onClose={() => setHint(null)}
          />
        )
      }
    </FormItem>
  )
}
