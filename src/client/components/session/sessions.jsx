import Session from './session'
import _ from 'lodash'
import classNames from 'classnames'

export default function Sessions (props) {
  const {
    store, tabs, config
  } = props
  return tabs.map((tab) => {
    const { id } = tab
    const cls = classNames(
      `session-${id}`,
      {
        'session-current': id === store.currentTabId
      },
      {
        hide: id !== store.currentTabId
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
