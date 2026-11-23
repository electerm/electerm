/**
 * bookmark form - "open in a new tab" for the local RDP client
 *
 * The tab that a local-client bookmark creates holds nothing but the launch
 * status and two buttons, and in a split layout it also takes a pane away from
 * the real sessions. This option lets that bookmark skip it: the external window
 * is the session, and the attempt still lands in the connection history.
 *
 * Shown only when the bookmark asks for the local client at all (and only on a
 * build that has one), because for the built-in client the tab *is* the session.
 * `Form.useWatch` is how the rest of this form reacts to another field, see
 * ./category-select.jsx.
 *
 * Registered as field type 'nativeRdpTab' in ./fields.jsx and used by
 * ../config/rdp.js.
 */
import { Form } from 'antd'
import SwitchLabel from '../../common/switch.jsx'
import { canUseNativeRdp } from '../../../common/native-rdp.js'

const FormItem = Form.Item

export default function NativeRdpTabOption ({ form }) {
  const nativeRdp = Form.useWatch('nativeRdp', form)

  // no local client here: nothing to choose, and the built-in session needs its tab
  if (!canUseNativeRdp() || !nativeRdp) {
    return null
  }

  return (
    <FormItem
      label='Open in a new tab'
      name='nativeRdpTab'
      valuePropName='checked'
    >
      <SwitchLabel />
    </FormItem>
  )
}
