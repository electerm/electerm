/**
 * transporter UI component
 */

import Transport from './transfer'

export default function TransportsUI (props) {
  console.log('ptopds', props)
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
    console.log('trProps', trProps)
    return (
      <Transport
        {...trProps}
        key={id + ':tr:' + i}
      />
    )
  })
}
