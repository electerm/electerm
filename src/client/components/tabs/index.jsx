/**
 * session tabs component
 * @param {array} props.tabs {id, title}
 */

import {Component} from '../common/react-subx'
import _ from 'lodash'
import {Icon, Button, Dropdown, Menu} from 'antd'
import Tab from './tab'
import MenuBtn from '../control/menu-btn'
import './tabs.styl'
import {tabWidth, tabMargin, isMac} from '../../common/constants'
import copy from 'json-deep-copy'
import createName from '../../common/create-title'

const {prefix} = window
const e = prefix('tabs')
const ButtonGroup = Button.Group
const MenuItem = Menu.Item
const extraWidth = 113
const menuWidth = 37

export default class Tabs extends Component {

  componentDidMount() {
    this.dom = document.querySelector('.tabs-inner')
    window.addEventListener('keydown', this.handleTabHotkey)
    window.addEventListener('message', this.onAdjustScroll)
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleTabHotkey)
  }

  onAdjustScroll = (e) => {
    if (e.data && e.data.type === 'tab-change') {
      this.adjustScroll()
    }
  }

  handleTabHotkey = e => {
    if (
      (
        (e.ctrlKey && !isMac) ||
        (e.metaKey && isMac)
      ) &&
      e.code === 'Tab'
    ) {
      this.props.store.clickNextTab()
    }
  }

  onAdd = e => {
    if (!e.target.classList.contains('tabs-wrapper')) {
      return
    }
    this.props.onAdd()
  }

  adjustScroll = () => {
    let {width, tabs, currentTabId, showControl} = this.props.store
    let index = _.findIndex(tabs, t => t.id === currentTabId)
    let w = (index + 1) * (tabMargin + tabWidth) + 5
    let scrollLeft = w > width - extraWidth
      ? w - width + extraWidth - (showControl ? 0 : menuWidth)
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
    let {tabs = []} = this.props.store
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
    let {tabs = [], width, showControl} = this.props.store
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
            className="tabs-wrapper relative"
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
                    tab={copy(tab)}
                    key={i + '##' + tab.id}
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
          !showControl
            ? (
              <MenuBtn />
            )
            : null
        }
        {
          overflow
            ? this.renderExtra()
            : null
        }
      </div>
    )
  }

}
