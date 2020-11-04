/**
 * quick command list
 */

import React from 'react'
import QmItem from './quick-command'

export default class QmList extends React.Component {
  // componentDidMount () {
  //   this.props.form.validateFields(['quickCommands'])
  // }

  render () {
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
  }
}
