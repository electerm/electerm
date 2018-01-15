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
    openAbout
  } = props
  return (
    <div className="btns pd1 borderb fix">
      <div className="fleft">
        <Button
          className="mg1r iblock"
          type="ghost"
          icon="plus"
          onClick={onNewSsh}
        >{e('newSsh')}</Button>
        <Select
          className="mg1r iblock"
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
          className="iblock"
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
            className="font16 mg1x pointer iblock"
            onClick={onEditBookmark}
          />
        </Tooltip>
        <Button
          className="mg2l iblock"
          type="ghost"
          icon="setting"
          onClick={openSetting}
        >{c('setting')}</Button>
      </div>
      <div className="fright line-height28">
        <Icon
          type="reload"
          className="pointer mg1x font14"
          title={m('reload')}
          onClick={() => location.reload()}
        />
        <Icon
          type="info-circle-o"
          title={m('about')}
          className="pointer mg1l mg2r font14"
          onClick={openAbout}
        />
      </div>
    </div>
  )

}
