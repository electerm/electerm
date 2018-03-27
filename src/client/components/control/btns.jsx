/**
 * btns
 */

import {Button, Select, Icon, Tooltip} from 'antd'
import createName from '../../common/create-title'

const {Option} = Select
const {prefix} = window
const e = prefix('control')
const c = prefix('common')
const m = prefix('menu')
const h = prefix('transferHistory')

const commonSelectProps = {
  showSearch: true,
  optionFilterProp: 'children',
  notFoundContent: e('notFoundContent'),
  dropdownMatchSelectWidth: false,
  className: 'iblock width120 mg1r'
}

export default function Btns(props) {

  let {
    onNewSsh,
    onSelectHistory,
    openSetting,
    onSelectBookmark,
    bookmarks = [],
    history = [],
    onEditBookmark,
    openAbout,
    openTransferHistory,
    showControl,
    transferHistory
  } = props
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
        <Select
          onSelect={onSelectBookmark}
          className="iblock btn-select"
          placeholder={c('bookmarks')}
          {...commonSelectProps}
        >
          {
            bookmarks.map((tab, i) => {
              let {id} = tab
              return (
                <Option value={id} key={id + 'bm' + i}>{createName(tab)}</Option>
              )
            })
          }
        </Select>
        <Tooltip title={`${m('edit')} ${c('bookmarks')}`}>
          <Icon
            type="edit"
            className="font16 mg1x pointer iblock icon-do-edit"
            onClick={onEditBookmark}
          />
        </Tooltip>
        <Button
          className="mg2l iblock"
          type="ghost"
          icon="setting"
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
