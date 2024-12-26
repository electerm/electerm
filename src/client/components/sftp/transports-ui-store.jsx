/**
 * transporter UI component
 */

import Transport from './transport-action-store'

export default function TransportsUI (props) {
  const { fileTransfers } = props
  if (!fileTransfers.length) {
    return null
  }
  return fileTransfers.map((t, i) => {
    const { id } = t
    const trProps = {
      transfer: t,
      index: i,
      inited: t.inited,
      cancel: t.cancel,
      pausing: t.pausing,
      config: props.config
    }
    return (
      <Transport
        {...trProps}
        key={id + ':tr:' + i}
      />
    )
  })
}
