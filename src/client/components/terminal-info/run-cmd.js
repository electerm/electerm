/**
 * run command in remote terminal
 */

import { runCmd } from '../terminal/terminal-apis'
import { useEffect } from 'react'
import wait from '../../common/wait'

function formatActivities (str) {
  if (!str) {
    return {
      activities: []
    }
  }
  const r = str.split('\n')
    .filter(s => s)
    .map(st => {
      const arr = st.split(/ +/)
      return {
        pid: arr[0],
        user: arr[1],
        cpu: arr[2],
        mem: arr[3],
        cmd: arr.slice(4).join(' ')
      }
    }).filter(d => d.pid)
  return {
    activities: r
  }
}

function formatDisks (str) {
  if (!str) {
    return {
      disks: []
    }
  }
  const r = str.split('\n')
    .slice(1)
    .map(s => {
      const arr = s.split(/ +/)
      return {
        filesystem: arr[0],
        size: arr[1],
        used: arr[2],
        avail: arr[3],
        usedPercent: arr[4],
        mount: arr[5]
      }
    })
    .filter(d => d.filesystem)
  return {
    disks: r
  }
}

function formatCpu (str) {
  if (!str) {
    return {
      cpu: ''
    }
  }
  return {
    cpu: str.split(' ')[1]
  }
}

function formatMem (str) {
  if (!str) {
    return {}
  }
  return str
    .split('\n')
    .filter(d => d)
    .slice(1)
    .reduce((p, d) => {
      const arr = d.split(/\s+/)
      if (!arr[1]) {
        return p
      }
      p[arr[0].replace(':', '').toLowerCase()] = {
        total: arr[1],
        used: arr[2],
        free: arr[3]
      }
      return p
    }, {})
}

const ipSplitReg = /\n[\d]{1,5}:\s+/
const ipNameReg = /inet\s+([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})\/\d/

function formatIps (ips) {
  if (!ips) {
    return {}
  }
  const arr = ips.split(ipSplitReg)
  return arr.reduce((p, s) => {
    const name = s.replace(/^[\d]{1,5}:\s+/, '').split(/:\s+/)[0]
    const arr1 = s.match(ipNameReg)
    return {
      ...p,
      [name]: {
        ip: arr1 ? arr1[1] : ''
      }
    }
  }, {})
}

function formatTraffic (traffic, ipObj) {
  if (!traffic) {
    return ipObj
  }
  const arr = traffic.split(ipSplitReg)
  return arr.reduce((p, s) => {
    const name = s.replace(/^[\d]{1,5}:\s+/, '').split(/:\s+/)[0]
    const arr1 = s.split('\n')
    let download = 0
    let upload = 0
    const len = arr1.length
    for (let i = 0; i < len; i++) {
      const line = arr1[i]
      if (line.toLowerCase().trim().startsWith('rx')) {
        download = Number(arr1[i + 1].trim().split(/\s+/)[0])
      } else if (line.trim().toLowerCase().startsWith('tx')) {
        upload = Number(arr1[i + 1].trim().split(/\s+/)[0])
      }
    }
    if (!p[name]) {
      p[name] = {}
    }
    Object.assign(p[name], {
      download, upload
    })
    return p
  }, ipObj)
}

function formatNetwork (traffic, ips) {
  const ipObj = formatIps(ips)
  return {
    network: formatTraffic(traffic, ipObj)
  }
}

// function format (arr) {
//   if (!arr) {
//     return {}
//   }
//   // const arr = res.split(sepStr)
//   // console.log(arr)
//   const uptime = arr[0]
//   const activities = formatActivities(arr[1])
//   const disks = formatDisks(arr[2])
//   const cpu = formatCpu(arr[3])
//   const { mem, swap } = formatMem(arr[4])
//   const { network, ip } = formatNetwork(arr[5], arr[6])
//   const final = {
//     ip,
//     uptime,
//     activities,
//     disks,
//     cpu,
//     mem,
//     swap,
//     network
//   }
//   console.log(final, 'fff')
//   return final
// }

export async function runCmds (props, cmds) {
  const {
    pid,
    sessionId
  } = props
  const ress = []
  for (const cmd of cmds) {
    const res = await runCmd(pid, sessionId, cmd)
    ress.push(res || '')
  }
  return ress
}

function InfoGetter (props) {
  const {
    // name,
    cmd,
    cmds,
    interval,
    formatter,
    delay
  } = props.options
  const cms = cmds || [cmd]
  useEffect(() => {
    const run = async () => {
      await wait(delay)
      const ress = await runCmds(props, cms)
      const update = formatter(...ress)
      // console.log(name)
      // console.log(ress)
      // console.log(update)
      // console.log(name)
      props.setState(update)
    }
    run()
    const ref = setInterval(run, interval)
    return () => {
      clearInterval(ref)
    }
  }, [])
  return null
}

export default (props) => {
  if (!props.isRemote) {
    return null
  }
  const cmds = [
    {
      name: 'uptime',
      cmd: 'uptime -p',
      interval: 5000,
      delay: 0,
      formatter: d => ({ uptime: d })
    },
    {
      name: 'activities',
      cmd: 'ps --no-headers -o pid,user,%cpu,size,command ax | sort -b -k3 -r',
      interval: 5000,
      delay: 800,
      formatter: formatActivities
    },
    {
      name: 'disks',
      cmd: 'df -h',
      interval: 10000,
      delay: 1600,
      formatter: formatDisks
    },
    {
      name: 'cpu',
      cmd: `(grep 'cpu ' /proc/stat;sleep 0.1;grep 'cpu ' /proc/stat)|awk -v RS="" '{print "CPU "($13-$2+$15-$4)*100/($13-$2+$15-$4+$16-$5)"%"}'`,
      interval: 5000,
      formatter: formatCpu,
      delay: 2400
    },
    {
      name: 'mem',
      cmd: 'free -h',
      interval: 5000,
      delay: 3200,
      formatter: formatMem
    },
    {
      name: 'network',
      cmds: [
        'ip -s link',
        'ip addr'
      ],
      delay: 4000,
      formatter: formatNetwork,
      interval: 5000
    }
  ]
  return cmds.map(options => {
    return (
      <InfoGetter
        key={'info-getter-' + options.name}
        {...props}
        options={options}
      />
    )
  })
}
