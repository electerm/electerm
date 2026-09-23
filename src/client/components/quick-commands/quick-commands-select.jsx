/**
 * quick commands footer selection
 *
 * Click to toggle the quick-command bar. Click-based so it works identically
 * on touch (mobile) and mouse (desktop) — the old hover-to-open model was
 * unreliable on Android, where a tap synthesizes mouseleave and cancels the
 * open timer.
 */

import { PureComponent } from 'react'
import { Button } from 'antd'
import './qm.styl'

export default class QuickCommandsFooter extends PureComponent {
  handleClick = () => {
    const { store } = window
    store.openQuickCommandBar = !store.openQuickCommandBar
  }

  render () {
    return (
      <div className='fleft relative quick-command-trigger-wrap'>
        <Button
          size='small'
          type='text'
          onClick={this.handleClick}
        >
          Q
        </Button>
      </div>
    )
  }
}
