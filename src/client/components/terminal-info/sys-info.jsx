/**
 * system info: os / hostname / kernel / arch (+ shell for local terminals)
 * remote info comes from uname via the session runCmd bridge,
 * local info from the os module + a shell version probe
 */

import { useEffect, useState } from 'react'
import { DesktopOutlined } from '@ant-design/icons'
import resolveLocalInfo from './local-info-resolver'

export default function TerminalInfoSys (props) {
  const { sysInfo, isRemote, pid } = props
  const [localInfo, setLocalInfo] = useState(null)

  useEffect(() => {
    if (isRemote) {
      return
    }
    resolveLocalInfo(pid).then(setLocalInfo)
  }, [isRemote, pid])

  const info = isRemote ? sysInfo : localInfo
  if (!info || !info.os) {
    return null
  }
  const rows = [
    ['os', info.os],
    ['hostname', info.hostname],
    ['kernel', info.kernel],
    ['arch', info.arch]
  ]
  if (info.shell) {
    rows.push(['shell', info.shellVersion ? `${info.shell} ${info.shellVersion}` : info.shell])
  }
  const final = rows.filter(d => d[1])
  if (!final.length) {
    return null
  }
  return (
    <div className='terminal-info-section terminal-info-sys'>
      <div className='pd1y bold'><DesktopOutlined /> System</div>
      <div className='terminal-info-sys-rows'>
        {
          final.map(([k, v]) => {
            return (
              <div className='terminal-info-sys-row' key={k}>
                <span className='terminal-info-sys-key'>{k}</span>
                <span className='terminal-info-sys-val' title={v}>{v}</span>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
