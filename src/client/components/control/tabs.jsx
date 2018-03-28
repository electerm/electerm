/**
 * tabs component
 * @param {array} props.tabs {id, title}
 */

import React from 'react'
import _ from 'lodash'
import {Icon, Button, Dropdown, Menu} from 'antd'
import Tab from './tab'
import './tabs.styl'
import {tabWidth, tabMargin} from '../../common/constants'
import createName from '../../common/create-title'

const {prefix} = window
const e = prefix('tabs')
const ButtonGroup = Button.Group
const MenuItem = Menu.Item
const extraWidth = 113

export default class Tabs extends React.Component {

  componentDidMount() {
    this.dom = document.querySelector('.tabs-inner')
  }

  componentDidUpdate() {
    this.adjustScroll()
  }

  onAdd = e => {
    if (!e.target.className.includes('tabs-wrapper')) {
      return
    }
    this.props.onAdd()
  }

  adjustScroll = () => {
    let {width, tabs, currentTabId} = this.props
    let index = _.findIndex(tabs, t => t.id === currentTabId)
    let w = (index + 1) * (tabMargin + tabWidth) + 5
    let scrollLeft = w > width - extraWidth
      ? w - width + extraWidth
      : 0
    this.dom.scrollLeft = scrollLeft
  }

  scrollLeft = () => {
    let {scrollLeft} = this.dom
    scrollLeft = scrollLeft - tabMargin - tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  scrollRight = () => {
    let {scrollLeft} = this.dom
    scrollLeft = scrollLeft + tabMargin + tabWidth
    if (scrollLeft < 0) {
      scrollLeft = 0
    }
    this.dom.scrollLeft = scrollLeft
  }

  onClickMenu = ({key}) => {
    let id = key.split('##')[1]
    this.props.onChange(id)
  }

  renderList = () => {
    let {tabs = []} = this.props
    return (
      <Menu onClick={this.onClickMenu}>
        {
          tabs.map((t, i) => {
            return (
              <MenuItem
                key={i + '##' + t.id}
              >{createName(t)}
              </MenuItem>
            )
          })
        }
      </Menu>
    )
  }

  renderAddBtn = () => {
    return (
      <Icon
        type="plus-circle-o"
        title={e('openNewTerm')}
        className="pointer tabs-add-btn font16"
        onClick={this.props.onAdd}
      />
    )
  }

  renderExtra() {
    return (
      <div className="tabs-extra pd1x">
        {this.renderAddBtn()}
        <ButtonGroup className="iblock mg1x">
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
          <Icon type="down" className="tabs-dd-icon" />
        </Dropdown>
      </div>
    )
  }

  render() {
    let {tabs = [], width} = this.props
    let len = tabs.length
    let addBtnWidth = 22
    let tabsWidthAll = (tabMargin + tabWidth) * len + 10
    let overflow = width < (tabsWidthAll + addBtnWidth)
    //let extraw = overflow ? extraWidth : 0
    return (
      <div className="tabs">
        <div
          className="tabs-inner"
          style={{
            width
          }}
        >
          <div
            className="tabs-wrapper"
            style={{
              width: tabsWidthAll + extraWidth + 10
            }}
            onDoubleClick={this.onAdd}
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
            {
              !overflow
                ? this.renderAddBtn()
                : null
            }
          </div>
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
