/**
 * tabs component
 * @param {array} props.tabs {id, title}
 */

import {Icon, Popover, Tooltip} from 'antd'
import classnames from 'classnames'
import createName from '../../common/create-title'
import './tabs.styl'

//todo: scroll controll and keyboard controll
//todo: click tabs-bg to add new
//todo: drag and drop

export default function Tabs(props) {

  let {tabs, currentTabId, onChange, onDup, onClose, onAdd} = props
  return (
    <div className="tabs">
      <div className="tabs-bg" onDoubleClick={onAdd} />
      <div className="tabs-inner">
        {
          tabs.map((tab, index) => {
            let {id} = tab
            let active = id === currentTabId
            let cls = classnames('tab', {active})
            let title = createName(tab)
            return (
              <Popover
                title={title}
                content="double click to duplicate"
                trigger="hover"
                key={id + 'tab' + index}
              >
                <div className={cls}>
                  <div
                    className="tab-title elli pd1x"
                    onClick={() => onChange(id)}
                    onDoubleClick={() => onDup(tab)}
                  >
                    {title}
                  </div>
                  <Icon className="pointer tab-close" type="close" onClick={() => onClose(id)} />
                </div>
              </Popover>
            )
          })
        }
      </div>
      <Tooltip title="open new terminal" placement="rightTop">
        <Icon type="plus-circle-o" className="pointer tabs-add-btn font16" onClick={onAdd} />
      </Tooltip>
    </div>
  )

}
