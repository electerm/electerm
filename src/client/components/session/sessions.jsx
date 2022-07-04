import { Component } from '../common/react-subx'
import Session from './session'
import _ from 'lodash'
import classNames from 'classnames'
import { commonActions } from '../../common/constants'

export default class Sessions extends Component {
  state = {
    currentTabId: ''
  }

  componentDidMount () {
    this.watch()
  }

  watch = () => {
    window.addEventListener('message', this.onEvent)
  }

  onEvent = e => {
    const {
      currentTabId,
      action
    } = e.data || {}
    if (
      action === commonActions.changeCurrentTabId &&
      currentTabId &&
      currentTabId !== this.state.currentTabId
    ) {
      this.setState({
        currentTabId
      }, this.postChange)
    }
  }

  postChange = () => {
    this.props.store.triggerReszie()
  }

  render () {
    const {
      store, tabs, config
    } = this.props
    const {
      currentTabId
    } = this.state
    return tabs.map((tab) => {
      const { id } = tab
      const cls = classNames(
        `session-wrap session-${id}`,
        {
          'session-current': id === currentTabId
        }
      )
      const tabProps = {
        tab,
        ..._.pick(store, [
          'currentTabId',
          'height',
          'width',
          'activeTerminalId'
        ]),
        config
      }
      return (
        <div className={cls} key={id}>
          <Session
            store={store}
            {...tabProps}
          />
        </div>
      )
    })
  }
}
