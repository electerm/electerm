/**
 * btns
 */

import {
  Button,
  Select,
  Icon,
  Tooltip,
  TreeSelect
} from 'antd'
import createName from '../../common/create-title'
import copy from 'json-deep-copy'

const {Option} = Select
const {prefix, getGlobal} = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const h = prefix('transferHistory')
const s = prefix('ssh')
const commonSelectProps = {
  showSearch: true,
  optionFilterProp: 'children',
  notFoundContent: e('notFoundContent'),
  dropdownMatchSelectWidth: false,
  className: 'iblock width120 mg1r'
}
const sshConfigItems = copy(getGlobal('sshConfigItems'))

export default function Btns(props) {

  let {
    onNewSsh,
    onSelectHistory,
    openSetting,
    onSelectBookmark,
    bookmarks = [],
    bookmarkGroups = [],
    history = [],
    onEditBookmark,
    openAbout,
    openTransferHistory,
    showControl,
    bookmarkId,
    modifier2,
    openTerminalThemes,
    transferHistory
  } = props
  let bookmarkMap = bookmarks.reduce((prev, b) => {
    return {
      ...prev,
      [b.id]: b
    }
  }, {})
  let treeData = bookmarkGroups.map(bg => {
    return {
      label: bg.title,
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
            label: createName(bm),
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
        label: 'ssh-config',
        children: sshConfigItems.map(bm => {
          return {
            label: createName(bm),
            value: bm.id,
            key: bm.id
          }
        })
      }
    ]
  }
  return (
    <div className={
      `btns pd1 borderb fix${showControl ? '' : ' hide'}`
    }
    >
      <div className="fleft">
        <Button
          className="mg1r iblock"
          type="ghost"
          icon="plus"
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
        <TreeSelect
          placeholder={c('bookmarks')}
          className="iblock btn-select"
          value={bookmarkId}
          onSelect={bookmarkId => {
            onSelectBookmark(bookmarkId)
            modifier2({
              bookmarkId
            })
          }}
          showSearch
          treeDefaultExpandAll
          dropdownMatchSelectWidth={false}
          dropdownStyle={{
            maxHeight: 400,
            maxWidth: 500,
            overflow: 'auto'
          }}
          onChange={(value, label, extra) => {
            if (!value) {
              onSelectBookmark(extra.triggerValue)
            }
            modifier2({
              bookmarkId: extra.triggerValue
            })
          }}
          treeData={treeData}
          treeNodeFilterProp="label"
          searchPlaceholder={s('search')}
        />
        <Tooltip title={`${m('edit')} ${c('bookmarks')}`}>
          <Icon
            type="edit"
            className="font16 mg1x mg2l pointer iblock control-icon icon-do-edit"
            onClick={onEditBookmark}
          />
        </Tooltip>
        <Icon
          type="picture"
          className="font16 mg2l iblock pointer control-icon"
          onClick={openTerminalThemes}
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
              <Button
                className="mg2l iblock"
                type="ghost"
                icon="swap"
                onClick={openTransferHistory}
                title={h('transferHistory')}
              />
            )
            : null
        }
      </div>
      <div className="fright line-height28">
        <Icon
          type="info-circle-o"
          title={m('about')}
          className="pointer mg1l mg2r font14 open-about-icon"
          onClick={openAbout}
        />
      </div>
    </div>
  )

}
