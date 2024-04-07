/**
 * quick commands footer selection
 */

import {
  PureComponent
} from 'react'
import {
  Button
} from 'antd'
import classNames from 'classnames'

export default class QuickCommandsItem extends PureComponent {
  handleSelect = (id) => {
    this.props.onSelect(
      this.props.item.id
    )
  }

  render () {
    const { name, id, nameMatch, labelMatch } = this.props.item
    const {
      draggable,
      handleDragOver,
      handleDragStart,
      handleDrop
    } = this.props
    const cls = classNames('qm-item mg1r mg1b', {
      'name-match': nameMatch,
      'label-match': labelMatch
    })
    return (
      <Button
        key={id}
        className={cls}
        onClick={this.handleSelect}
        data-id={id}
        draggable={draggable}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
      >
        {name}
      </Button>
    )
  }
}
