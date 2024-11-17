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
    return (
      <Transport
        {...props}
        transfer={t}
        inited={t.inited}
        cancel={t.cancel}
        pause={t.pausing}
        key={id + ':tr:' + i}
      />
    )
  })
}
