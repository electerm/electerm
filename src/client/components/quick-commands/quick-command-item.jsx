/**
 * quick commands footer selection
 */

import {
  PureComponent
} from 'react'
import {
  Button,
  Dropdown,
  Tooltip
} from 'antd'
import {
  CaretRightOutlined,
  CodeOutlined,
  EditOutlined
} from '@ant-design/icons'
import classNames from 'classnames'
import translateOr from '../../common/translate-fallback'

const e = window.translate

function stepLabel (step) {
  if (step.type === 'key') {
    return translateOr('key', 'Key')
  }
  if (step.type === 'wait') {
    return translateOr('waitForText', 'Wait for text')
  }
  if (step.type === 'prompt') {
    return translateOr('askForInput', 'Ask for input')
  }
  return e('command')
}

function stepValue (step) {
  if (step.type === 'key') {
    return step.key + (step.repeat > 1 ? ' ×' + step.repeat : '')
  }
  return step.type === 'wait' || step.type === 'prompt' ? step.text : step.command
}

export default class QuickCommandsItem extends PureComponent {
  state = {
    menuOpen: false,
    tipOpen: false
  }

  // the tooltip would otherwise sit on top of the right-click menu
  handleMenuOpenChange = (menuOpen) => {
    this.setState({ menuOpen, tipOpen: false })
  }

  handleTipOpenChange = (tipOpen) => {
    this.setState({ tipOpen })
  }

  handleSelect = () => {
    this.props.onSelect(
      this.props.item.id
    )
  }

  handleMenu = ({ key }) => {
    const { id } = this.props.item
    if (key === 'run') {
      this.handleSelect()
    } else if (key === 'runInTabs') {
      window.store.openQmRunInTabs(id)
    } else if (key === 'edit') {
      window.store.editQuickCommandItem(id)
    }
  }

  menuItems () {
    return [
      {
        key: 'run',
        icon: <CaretRightOutlined />,
        label: translateOr('run', 'Run')
      },
      {
        key: 'runInTabs',
        icon: <CodeOutlined />,
        label: translateOr('runInTerminals', 'Run in terminals...')
      },
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: e('edit')
      }
    ]
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
                      <span className='qm-tooltip-label'>{stepLabel(c)}:</span>
                      <code className='qm-tooltip-value'>
                        {stepValue(c)}
                      </code>
                    </div>
                    {
                      c.delay > 0 && (
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
      <Dropdown
        trigger={['contextMenu']}
        menu={{ items: this.menuItems(), onClick: this.handleMenu }}
        onOpenChange={this.handleMenuOpenChange}
      >
        <Tooltip
          open={this.state.tipOpen && !this.state.menuOpen}
          onOpenChange={this.handleTipOpenChange}
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
      </Dropdown>
    )
  }
}
