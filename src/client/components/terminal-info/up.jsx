/**
 * up time info
 */

export default function TerminalInfoUp (props) {
  const { uptime } = props
  if (!props.isRemote) {
    return null
  }
  return (
    <div className='terminal-info-section terminal-info-up'>
      <b>uptime</b>: {uptime}
    </div>
  )
}
