/**
 * cpu/swap/mem general usage
 */

import { isEmpty, isUndefined } from 'lodash-es'
import { Progress } from 'antd'
import parseInt10 from '../../common/parse-int10'

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
  const { cpu, mem, swap, isRemote, terminalInfos } = props
  if (
    !isRemote ||
    (!terminalInfos.includes('cpu') &&
    !terminalInfos.includes('mem') &&
    !terminalInfos.includes('swap'))
  ) {
    return null
  }
  function getColorForPercent (percent) {
    if (percent >= 90) return '#ff4d4f'
    if (percent >= 70) return '#faad14'
    if (percent >= 50) return '#1890ff'
    return '#52c41a'
  }

  function renderItem (obj) {
    if (isEmpty(obj)) {
      return <div className='pd1b' key={obj.name}>NA</div>
    }
    const {
      used,
      total,
      percent,
      name
    } = obj
    const hasPercent = !isUndefined(percent)
    const p = hasPercent
      ? percent
      : computePercent(used, total) || 0
    const color = getColorForPercent(p)
    const fmt = hasPercent
      ? (p) => `${name}: ${p || ''}%`
      : (p) => `${name}: ${p || ''}%(${used || ''}/${total || ''})`
    return (
      <div className='pd1b' key={name}>
        <Progress
          style={{ width: '50%' }}
          percent={p}
          format={fmt}
          strokeColor={color}
        />
      </div>
    )
  }
  const data = []
  if (terminalInfos.includes('cpu')) {
    data.push({
      name: 'cpu',
      percent: parseInt10(cpu)
    })
  }
  if (terminalInfos.includes('mem')) {
    data.push({
      name: 'mem',
      ...mem
    })
  }
  if (terminalInfos.includes('swap')) {
    data.push({
      name: 'swap',
      ...swap
    })
  }
  return (
    <div className='terminal-info-section terminal-info-resource'>
      {
        data.map(renderItem)
      }
    </div>
  )
}
