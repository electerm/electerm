/**
 * tabs component
 * @param {array} props.tabs {id, title}
 */

import {Icon, Tooltip} from 'antd'
import Tab from './tab'
import './tabs.styl'

//todo: scroll controll and keyboard controll
//todo: drag and drop

export default function Tabs(props) {

  let {tabs, onAdd} = props
  return (
    <div className="tabs">
      <div className="tabs-bg" onDoubleClick={onAdd} />
      <div className="tabs-inner">
        {
          tabs.map((tab, i) => {
            return (
              <Tab
                {...props}
                tab={tab}
                key={i + 'tab'}
              />
            )
          })
        }
      </div>
      <Tooltip title="open new terminal" placement="rightTop">
        <Icon
          type="plus-circle-o"
          className="pointer tabs-add-btn font16"
          onClick={onAdd}
        />
      </Tooltip>
    </div>
  )

}
