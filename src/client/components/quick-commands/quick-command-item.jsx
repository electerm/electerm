/**
 * quick commands footer selection
 */

import {
  PureComponent
} from 'react'
import {
  Button,
  Tooltip
} from 'antd'
import classNames from 'classnames'

const e = window.translate

export default class QuickCommandsItem extends PureComponent {
  handleSelect = () => {
    this.props.onSelect(
      this.props.item.id
    )
  }

  renderTooltip () {
    const { name, commands, shortcut, inputOnly } = this.props.item
    return (
      <div className='qm-tooltip-content'>
        {
          name && (
            <div className='qm-tooltip-title'>{name}</div>
          )
        }
        {
          commands && commands.length > 0 && (
            <ul className='qm-tooltip-cmd-list'>
              {
                commands.map((c, i) => (
                  <li key={i} className='qm-tooltip-cmd-item'>
                    {
                      c.name && (
                        <div className='qm-tooltip-cmd-name'>
                          <span className='qm-tooltip-label'>{e('name')}:</span>
                          <span className='qm-tooltip-value'>{c.name}</span>
                        </div>
                      )
                    }
                    <div className='qm-tooltip-cmd-text'>
                      <span className='qm-tooltip-label'>{e('quickCommand')}:</span>
                      <code className='qm-tooltip-value'>{c.command}</code>
                    </div>
                    {
                      c.delay && (
                        <div className='qm-tooltip-cmd-delay'>
                          <span className='qm-tooltip-label'>{e('delay')}:</span>
                          <span className='qm-tooltip-value'>{c.delay}ms</span>
                        </div>
                      )
                    }
                  </li>
                ))
              }
            </ul>
          )
        }
        {
          (shortcut || inputOnly) && (
            <div className='qm-tooltip-meta'>
              {
                shortcut && (
                  <div>
                    <span className='qm-tooltip-label'>{e('settingShortcuts')}:</span>
                    <span className='qm-tooltip-value'>{shortcut}</span>
                  </div>
                )
              }
              {
                inputOnly && (
                  <div>[{e('inputOnly')}]</div>
                )
              }
            </div>
          )
        }
      </div>
    )
  }

  render () {
    const { name, id } = this.props.item
    const {
      draggable,
      handleDragOver,
      handleDragStart,
      handleDragEnter,
      handleDragLeave,
      handleDrop
    } = this.props
    const cls = classNames('qm-item mg1r mg1b')
    const btnProps = {
      className: cls,
      onClick: this.handleSelect,
      'data-id': id,
      draggable,
      onDragOver: handleDragOver,
      onDragStart: handleDragStart,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }
    return (
      <Tooltip
        title={this.renderTooltip()}
        placement='top'
        mouseEnterDelay={0.5}
        classNames={{ root: 'qm-tooltip-overlay' }}
      >
        <Button
          key={id}
          {...btnProps}
        >
          {name}
        </Button>
      </Tooltip>
    )
  }
}
