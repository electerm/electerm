/**
 * quick commands footer selection
 */

import { PureComponent } from 'react'
import { Button } from 'antd'
import './qm.styl'

const { prefix } = window
const e = prefix('quickCommands')

export default class QuickCommandsFooter extends PureComponent {
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
      <div className='fleft relative'>
        <Button
          size='small'
          onMouseEnter={this.handleOpen}
          onMouseLeave={this.handleMouseLeave}
          type='ghost'
        >
          <span className='w500'>{e('quickCommands')}</span>
          <span className='l500'>Q</span>
        </Button>
      </div>
    )
  }
}
