/**
 * quick commands footer selection
 */

import { PureComponent } from 'react'
import { Button } from 'antd'
import './qm.styl'

const { prefix } = window
const e = prefix('quickCommands')

export default class QuickCommandsFooter extends PureComponent {
  open = () => {
    this.timer = setTimeout(this.act, 500)
  }

  act = () => {
    window.store.openQuickCommandBar = true
  }

  onMouseLeave = () => {
    clearTimeout(this.timer)
  }

  render () {
    return (
      <div className='fleft relative'>
        <Button
          size='small'
          type='ghost'
          className='qm-trigger'
          onMouseEnter={this.open}
          onMouseLeave={this.onMouseLeave}
        >
          <span className='qm-full'>{e('quickCommands')}</span>
          <span className='qm-compact'>Q</span>
        </Button>
      </div>
    )
  }
}
