/**
 * quick command list
 */

import { memo } from 'react'
import QmItem from './quick-command'

export default memo(function QMList (props) {
  const { quickCommands, form } = this.props
  return (
    <div className='pd3b mg3b'>
      <QmItem
        form={form}
        item={{}}
      />
      {
        quickCommands.map((item, i) => {
          return (
            <QmItem
              form={this.props.form}
              item={item}
              i={i}
            />
          )
        })
      }
    </div>
  )
})
