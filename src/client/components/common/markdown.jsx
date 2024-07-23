/**
 * render markdown text proper
 */

import classnames from 'classnames'

export default ({ text = '' }) => {
  const arr = text.split(/[\n\r]+/g)
  function render (txt, i) {
    const empty = txt.trim().length
    const bold = !txt.startsWith('- ') || txt.startsWith('#')
    const cls = classnames({
      bold,
      mg1y: empty || bold
    })
    return (
      <div className={cls} key={'upgrade-info-' + i}>{txt}</div>
    )
  }
  return (
    <div className='markdown-wrap'>
      {
        arr.map(render)
      }
    </div>
  )
}
