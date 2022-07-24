/**
 * show base terminal info, id sessionID
 */

// import { createLogFileName } from '../../../app/common/create-session-log-file-path'
import { osResolve } from '../../common/resolve'
import ShowItem from '../common/show-item'

const { prefix } = window
const c = prefix('common')
const st = prefix('setting')

export default function TerminalInfoBase (props) {
  const { id, saveTerminalLogToFile, logName } = props
  const path = osResolve(props.appPath, 'electerm', 'session_logs', logName + '.log')
  const to = saveTerminalLogToFile
    ? <ShowItem disabled={!saveTerminalLogToFile} to={path}>{path}</ShowItem>
    : `-> ${c('setting')} -> ${st('saveTerminalLogToFile')}`
  return (
    <div className='terminal-info-section terminal-info-base'>
      <p><b>ID:</b> {id}</p>
      <p><b>log:</b> {to}</p>
    </div>
  )
}
