/**
 * when in alternate buffer, user press cmd + arrow up to open normal buffer content
 */

import { CloseCircleOutlined } from '@ant-design/icons'
import { memo } from 'react'

export default memo(function NormalBuffer (props) {
  if (!props.lines.length) {
    return null
  }
  return (
    <div className='terminal-normal-buffer'>
      <div className='terminal-normal-buffer-body'>
        {props.lines.map((d, i) => (<div key={`${i}-nmb`}>{d}</div>))}
      </div>
      <div className='terminal-normal-buffer-footer fix'>
        <span className='fleft pd1l'>
          Normal buffer content
        </span>
        <span className='fright pd1r'>
          <CloseCircleOutlined
            className='terminal-normal-buffer-close'
            onClick={props.close}
          />
        </span>
      </div>
    </div>
  )
})
