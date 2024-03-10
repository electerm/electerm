/**
 * up time info
 */

export default function TerminalInfoUp (props) {
  const { uptime, isRemote, terminalInfos } = props
  if (!isRemote || !terminalInfos.includes('uptime')) {
    return null
  }
  return (
    <div className='terminal-info-section terminal-info-up'>
      <b>uptime</b>: {uptime}
    </div>
  )
}
