/**
 * quick commands footer selection
 *
 * Click to toggle the quick-command bar. Click-based so it works identically
 * on touch (mobile) and mouse (desktop) — the old hover-to-open model was
 * unreliable on Android, where a tap synthesizes mouseleave and cancels the
 * open timer.
 *
 * The panel has two homes (see quick-commands-box.jsx): the footer box and the
 * right side panel. While it is docked, this button is repurposed to open and
 * close that panel, exactly like the info and AI icons do — and `active` (fed
 * by the footer, which is already reactive) keeps it lit while it is showing.
 */

import { PureComponent } from 'react'
import { Button } from 'antd'
import './qm.styl'

export default class QuickCommandsFooter extends PureComponent {
  handleClick = () => {
    const { store } = window
    if (store.quickCommandsInRightPanel) {
      store.toggleQuickCommandsPanel()
      return
    }
    store.openQuickCommandBar = !store.openQuickCommandBar
  }

  render () {
    const { active } = this.props
    return (
      <div className='fleft relative quick-command-trigger-wrap'>
        <Button
          size='small'
          type='text'
          className={'quick-command-trigger' + (active ? ' active' : '')}
          onClick={this.handleClick}
        >
          Q
        </Button>
      </div>
    )
  }
}
