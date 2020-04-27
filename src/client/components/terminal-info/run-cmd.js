/**
 * run command in remote terminal
 */

import fetch from '../../common/fetch'

const sepStr = '---sep---'

function formatActivities (str) {
  if (!str) {
    return []
  }
  return str.split('\n')
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
}

function formatDisks (str) {
  if (!str) {
    return []
  }
  return str.split('\n')
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
}

function formatCpu (str) {
  if (!str) {
    return ''
  }
  return str.split(' ')[1]
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
      const arr = d.split(/ +/)
      p[arr[0].toLowerCase()] = {
        total: arr[1],
        used: arr[2],
        free: arr[3]
      }
      return p
    }, {})
    .filter(d => d.total)
}

function formatNetwork (str) {
  if (!str) {
    return {
      ip: '',
      network: {}
    }
  }
}

function format (res) {
  if (!res) {
    return {}
  }
  const arr = res.split(sepStr)
  const uptime = arr[0]
  const activities = formatActivities(arr[1])
  const disks = formatDisks(arr[2])
  const cpu = formatCpu(arr[3])
  const { mem, swap } = formatMem(arr[4])
  const { network, ip } = formatNetwork(arr[5])
  return {
    ip,
    uptime,
    activities,
    disks,
    cpu,
    mem,
    swap,
    network
  }
}

export default async ({
  host,
  port,
  pid,
  sessionId
}) => {
  const cmds = [
    'uptime -p',
    'ps --no-headers -o pid,user,%cpu,size,command ax | sort -b -k3 -r',
    'df -h',
    `(grep 'cpu ' /proc/stat;sleep 0.1;grep 'cpu ' /proc/stat)|awk -v RS="" '{print "CPU "($13-$2+$15-$4)*100/($13-$2+$15-$4+$16-$5)"%"}'`,
    'free -h',
    'ip -s link'
  ]
  const sep = ` ; echo "${sepStr}" ; `
  const cmd = cmds.join(sep)
  const url = `http://${host}:${port}/terminals/${pid}/run-cmd?sessionId=${sessionId}`
  const res = await fetch.post(url, {
    cmd
  }, {
    handleErr: log.error
  })
  return format(res)
}
