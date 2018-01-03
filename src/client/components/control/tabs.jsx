/**
 * tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import {Icon, Tooltip, Button} from 'antd'
import Tab from './tab'
import './tabs.styl'
import {tabWidth, tabMargin} from '../../common/constants'

const ButtonGroup = Button.Group
//todo: scroll controll and keyboard controll
//todo: drag and drop



export default class Tabs extends React.Component {

  renderExtra() {
    return (
      <div className="tabs-extra">

      </div>
    )
  }

  render() {
    let {tabs = [], onAdd, width} = this.props
    let len = tabs.length
    let addBtnWidth = 22
    let tabsWidthAll = (tabMargin + tabWidth) * len + 10
    let overflow = width < (tabsWidthAll + addBtnWidth)
    let extraWidth = overflow ? 48 + 3 + 5 + 5 : 0
    return (
      <div className="tabs">
        <div className="tabs-bg" onDoubleClick={onAdd} />
        <div
          className="tabs-inner"
          style={{
            paddingRight: extraWidth
          }}
        >
          {
            tabs.map((tab, i) => {
              return (
                <Tab
                  {...this.props}
                  tab={tab}
                  key={i + 'tab'}
                />
              )
            })
          }
          <Tooltip title="open new terminal" placement="rightTop">
            <Icon
              type="plus-circle-o"
              className="pointer tabs-add-btn font16"
              onClick={onAdd}
            />
          </Tooltip>
        </div>
        {
          overflow
            ? this.renderExtra()
            : null
        }
      </div>
    )
  }

}
