/**
 * quick commands footer selection
 */

import {
  PureComponent
} from 'react'
import {
  Button
} from 'antd'

export default class QuickCommandsItem extends PureComponent {
  onSelect = (id) => {
    this.props.onSelect(
      this.props.item.id
    )
  }

  render () {
    const { name, id } = this.props.item
    return (
      <Button
        key={id}
        className='mg1r mg1b'
        onClick={this.onSelect}
      >
        {name}
      </Button>
    )
  }
}
