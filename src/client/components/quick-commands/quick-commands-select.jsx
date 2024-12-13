/**
 * quick commands footer selection
 */

import { PureComponent } from 'react'
import { Button } from 'antd'
import './qm.styl'

const e = window.translate

export default class QuickCommandsFooter extends PureComponent {
  componentWillUnmount () {
    clearTimeout(this.timer)
    this.timer = null
  }

  handleOpen = () => {
    this.timer = setTimeout(this.act, 500)
  }

  act = () => {
    window.store.openQuickCommandBar = true
  }

  handleMouseLeave = () => {
    clearTimeout(this.timer)
  }

  render () {
    return (
      <div
        className='fleft relative quick-command-trigger-wrap'
        onMouseEnter={this.handleOpen}
        onMouseLeave={this.handleMouseLeave}
      >
        <Button
          size='small'
          type='ghost'
        >
          <span className='w500'>{e('quickCommands')}</span>
          <span className='l500'>Q</span>
        </Button>
      </div>
    )
  }
}
