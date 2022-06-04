import Session from './session'
import _ from 'lodash'

export default function Sessions (props) {
  const {
    store, tabs, config
  } = props
  return tabs.map((tab) => {
    const { id } = tab
    const cls = id !== store.currentTabId
      ? 'hide'
      : 'ssh-wrap-show'
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
