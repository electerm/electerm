/**
 * cpu/swap/mem general usage
 */

import _ from 'lodash'

export default function TerminalInfoResource (props) {
  const { cpu, mem, swap } = props
  if (!props.isRemote) {
    return null
  }
  function renderMem (obj) {
    if (_.isEmpty(obj)) {
      return 'NA'
    }
    const {
      used,
      total
    } = obj
    // const p = Math.floor(used * 100 / (total || (used + 1)))
    return `${used}/${total}`
  }
  return (
    <div className='terminal-info-section terminal-info-resource'>
      <b>cpu</b>: {cpu}, <b>mem</b>: {renderMem(mem)}, <b>swap</b>: {renderMem(swap)}
    </div>
  )
}
