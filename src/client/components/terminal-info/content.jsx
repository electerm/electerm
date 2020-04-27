/**
 * info content module
 */

import TerminalInfoBase from './base'
import TerminalInfoUp from './up'
import TerminalInfoNetwork from './network'
import TerminalInfoResource from './resource'
import TerminalInfoActivities from './activity'
import TerminalInfoDisk from './disk'
import { useState, useEffect } from 'react'
import runCmd from './run-cmd'

export default function TerminalInfoContent (props) {
  const [state, setStateOri] = useState({
    ip: '',
    uptime: '',
    cpu: '',
    mem: {},
    swap: '',
    activities: [],
    disks: [],
    network: {}
  })
  function setState (obj) {
    setStateOri(s => ({
      ...s,
      ...obj
    }))
  }
  useEffect(() => {
    const ref = setInterval(async () => {
      const update = await runCmd(props)
      setState(update)
    }, 1000)
    return () => {
      clearInterval(ref)
    }
  }, [])
  const {
    ip,
    uptime,
    cpu,
    mem,
    swap,
    activities,
    disks,
    network
  } = state
  return (
    <div>
      <TerminalInfoBase {...props} />
      <TerminalInfoUp up={uptime} ip={ip} />
      <TerminalInfoActivities activities={activities} />
      <TerminalInfoResource
        cpu={cpu}
        mem={mem}
        swap={swap}
      />
      <TerminalInfoNetwork network={network} />
      <TerminalInfoDisk disks={disks} />
    </div>
  )
}
