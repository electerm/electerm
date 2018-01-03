/**
 * tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import {Icon, Tooltip, Button, Dropdown, Menu} from 'antd'
import Tab from './tab'
import './tabs.styl'
import {tabWidth, tabMargin} from '../../common/constants'
import createName from '../../common/create-title'

const ButtonGroup = Button.Group
const MenuItem = Menu.Item
//todo: scroll controll and keyboard controll
//todo: drag and drop



export default class Tabs extends React.Component {

  scrollLeft = () => {

  }

  scrollRight = () => {

  }

  renderList = () => {
    let {tabs = []} = this.props
    debug(tabs, 'dd')
    return (
      <Menu onClick={this.onClickMenu}>
        {
          tabs.map(t => {
            debug(t, t.id)
            return (
              <MenuItem key={t.id}>{createName(t)}</MenuItem>
            )
          })
        }
      </Menu>
    )
  }

  renderExtra() {
    return (
      <div className="tabs-extra pd1x">
        <ButtonGroup className="iblock mg1r">
          <Button
            icon="left"
            onClick={this.scrollLeft}
          />
          <Button
            icon="right"
            onClick={this.scrollRight}
          />
        </ButtonGroup>
        <Dropdown
          className="iblock"
          placement="bottomRight"
          overlay={this.renderList()}
        >
          <Icon type="down" />
        </Dropdown>
      </div>
    )
  }

  render() {
    let {tabs = [], onAdd, width} = this.props
    let len = tabs.length
    let addBtnWidth = 22
    let tabsWidthAll = (tabMargin + tabWidth) * len + 10
    let overflow = width < (tabsWidthAll + addBtnWidth)
    let extraWidth = overflow ? 86 : 0
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
