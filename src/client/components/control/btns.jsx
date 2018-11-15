/**
 * btns
 */

import {Component} from '../common/react-subx'
import {
  Select,
  Icon,
  Tooltip,
  TreeSelect
} from 'antd'
import createName from '../../common/create-title'
import copy from 'json-deep-copy'
import MenuBtn from './menu-btn'

const {Option} = Select
const {prefix, getGlobal} = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const h = prefix('transferHistory')
const s = prefix('ssh')
const t = prefix('terminalThemes')
const commonSelectProps = {
  showSearch: true,
  optionFilterProp: 'children',
  notFoundContent: e('notFoundContent'),
  dropdownMatchSelectWidth: false,
  className: 'iblock width120 mg1r'
}
const sshConfigItems = copy(getGlobal('sshConfigItems'))

export default class Btns extends Component {
  render() {
    let {
      bookmarks = [],
      bookmarkGroups = [],
      history = [],
      openAbout,
      transferHistory,
      isMaximized,
      onNewSsh,
      openSetting,
      openTerminalThemes,
      openTransferHistory,
      onSelectHistory,
      onSelectBookmark,
      bookmarkId
    } = this.props.store

    let minimize = () => {
      window.getGlobal('minimize')()
    }
    let maximize = () => {
      window.getGlobal('maximize')()
    }
    let unmaximize = () => {
      window.getGlobal('unmaximize')()
    }
    let closeApp = () => {
      window.getGlobal('closeApp')()
    }
    let bookmarkMap = bookmarks.reduce((prev, b) => {
      return {
        ...prev,
        [b.id]: b
      }
    }, {})
    let treeData = bookmarkGroups.map(bg => {
      return {
        title: bg.title,
        value: bg.id,
        key: bg.id,
        children: bg.bookmarkIds.reduce((p, id) => {
          let bm = bookmarkMap[id]
          if (!bm) {
            return p
          }
          return [
            ...p,
            {
              title: createName(bm),
              value: bm.id,
              key: bm.id
            }
          ]
        }, [])
      }
    })
    if (sshConfigItems.length) {
      treeData = [
        ...treeData,
        {
          title: 'ssh-config',
          children: sshConfigItems.map(bm => {
            return {
              title: createName(bm),
              value: bm.id,
              key: bm.id
            }
          })
        }
      ]
    }

    let bookmarkSelect = bookmarkGroups.length > 1
      ? (
        <TreeSelect
          placeholder={c('bookmarks')}
          className="iblock btn-select"
          value={bookmarkId}
          showSearch
          treeDefaultExpandAll
          dropdownMatchSelectWidth={false}
          dropdownStyle={{
            maxHeight: 400,
            maxWidth: 500,
            overflow: 'auto'
          }}
          onChange={(value, title, extra) => {
            onSelectBookmark(extra.triggerValue)
          }}
          treeData={treeData}
          treeNodeFilterProp="value"
          searchPlaceholder={s('search')}
        />
      )
      : (
        <Select
          onSelect={onSelectBookmark}
          placeholder={c('bookmarks')}
          {...commonSelectProps}
          className="iblock btn-select mg1r"
        >
          {
            [
              ...bookmarks,
              ...sshConfigItems
            ].map((tab, i) => {
              let {id} = tab
              return (
                <Option value={id} key={id + 'bm' + i}>{createName(tab)}</Option>
              )
            })
          }
        </Select>
      )
    return (
      <div className="btns relative borderb fix">
        <div className="left-btns relative">
          <MenuBtn />
          <Icon
            className="mg1r font20 pointer iblock control-icon"
            type="plus-circle"
            onClick={onNewSsh}
            title={e('newSsh')}
          />
          <Select
            className="mg1r iblock btn-select"
            onSelect={onSelectHistory}
            placeholder={c('history')}
            {...commonSelectProps}
          >
            {
              history.map((tab, i) => {
                let {id} = tab
                return (
                  <Option value={id} key={id + 'hs' + i}>{createName(tab)}</Option>
                )
              })
            }
          </Select>
          {bookmarkSelect}
          <Tooltip title={`${m('edit')} ${c('bookmarks')}`}>
            <Icon
              type="edit"
              className="font16 mg1x mg2l pointer iblock control-icon icon-do-edit"
              onClick={onNewSsh}
            />
          </Tooltip>
          <Icon
            type="picture"
            className="font16 mg2l iblock pointer control-icon"
            onClick={openTerminalThemes}
            title={t('terminalThemes')}
          />
          <Icon
            className="mg2l iblock pointer font16 control-icon"
            type="setting"
            onClick={openSetting}
            title={c('setting')}
          />
          {
            transferHistory.length
              ? (
                <Icon
                  className="mg2l font16 pointer iblock control-icon"
                  type="swap"
                  onClick={openTransferHistory}
                  title={h('transferHistory')}
                />
              )
              : null
          }
          <Icon
            type="info-circle-o"
            title={m('about')}
            className="mg2l iblock pointer font16 control-icon open-about-icon"
            onClick={openAbout}
          />
        </div>
        <div className="right-btns">
          <Icon
            type="minus"
            title={m('minimize')}
            className="mg2r iblock pointer font16 widnow-control-icon"
            onClick={minimize}
          />
          <span
            title={
              isMaximized ? m('unmaximize') : m('maximize')
            }
            className={
              'mg2r iblock pointer font16 icon-maximize widnow-control-icon ' +
                (isMaximized ? 'is-max' : 'not-max')
            }
            onClick={
              isMaximized ? unmaximize : maximize
            }
          />
          <Icon
            type="close"
            title={m('close')}
            className="mg2r iblock pointer font16 widnow-control-icon"
            onClick={closeApp}
          />
        </div>
      </div>
    )
  }
}
