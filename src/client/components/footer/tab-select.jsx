import {
  Popover
} from 'antd'
import TabItem from './batch-item'
import {
  CodeOutlined
} from '@ant-design/icons'

export default function TabSelect (props) {
  const { selectedTabIds, tabs, activeTabId } = props
  function renderTabs () {
    return tabs.map(tab => {
      const selected = selectedTabIds.includes(tab.id)
      const itemProps = {
        tab,
        selected,
        onSelect: props.onSelect,
        id: tab.id,
        isCurrent: tab.id === activeTabId
      }
      return (
        <TabItem
          key={tab.id}
          {...itemProps}
        />
      )
    })
  }
  function renderBtns () {
    return (
      <div className='pd1t pd2b font12'>
        <span
          className='mg1r pointer'
          onClick={props.onSelectAll}
        >
          All
        </span>
        <span
          className='pointer'
          onClick={props.onSelectNone}
        >
          None
        </span>
      </div>
    )
  }
  function renderContent () {
    return (
      <div className='pd1x'>
        {renderBtns()}
        {renderTabs()}
      </div>
    )
  }
  return (
    <Popover
      content={renderContent()}
      trigger='click'
    >
      <span className='pointer iblock pd1x'>
        ({selectedTabIds.length}) <CodeOutlined />
      </span>
    </Popover>
  )
}
