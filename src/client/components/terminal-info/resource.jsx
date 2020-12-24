/**
 * cpu/swap/mem general usage
 */

import _ from 'lodash'
import { Progress } from 'antd'

function toNumber (n = '') {
  let f = 1
  if (n.includes('G')) {
    f = 1024 * 1024
  } else if (n.includes('T')) {
    f = 1024 * 1024 * 1024
  } else if (n.includes('M')) {
    f = 1024
  }
  return f * parseFloat(n)
}

function computePercent (used, total) {
  const u = toNumber(used)
  const t = toNumber(total)
  return Math.floor(u * 100 / (t || (u + 1)))
}

export default function TerminalInfoResource (props) {
  const { cpu, mem, swap } = props
  if (!props.isRemote) {
    return null
  }
  function renderItem (obj) {
    if (_.isEmpty(obj)) {
      return <div className='pd1b' key={obj.name}>NA</div>
    }
    const {
      used,
      total,
      percent,
      name
    } = obj
    const hasPercent = !_.isUndefined(percent)
    const p = hasPercent
      ? percent
      : computePercent(used, total) || 0
    const fmt = hasPercent
      ? (p) => `${name}: ${p}%`
      : (p) => `${name}: ${p}%(${used}/${total})`
    return (
      <div className='pd1b' key={name}>
        <Progress
          style={{ width: '50%' }}
          percent={p}
          format={fmt}
        />
      </div>
    )
  }
  const data = [
    {
      name: 'cpu',
      percent: parseInt(cpu)
    },
    {
      name: 'mem',
      ...mem
    },
    {
      name: 'swap',
      ...swap
    }
  ]
  return (
    <div className='terminal-info-section terminal-info-resource'>
      {
        data.map(renderItem)
      }
    </div>
  )
}
