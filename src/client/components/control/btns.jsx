/**
 * btns
 */

import {Button, Select, Icon, Tooltip} from 'antd'
import createName from '../../common/create-title'

const {Option} = Select

const commonSelectProps = {
  showSearch: true,
  optionFilterProp: 'children',
  notFoundContent: 'not found',
  dropdownMatchSelectWidth: false,
  className: 'iblock width120 mg1r'
}


export default function Btns(props) {

  let {
    onNewSsh,
    onSelectHistory,
    openSetting,
    onSelectBookmark,
    bookmarks,
    history = [],
    onEditBookmark
  } = props
  return (
    <div className="btns pd1 borderb">
      <Button
        className="mg1r iblock"
        type="ghost"
        icon="plus"
        onClick={onNewSsh}
      >new ssh</Button>
      <Select
        className="mg1r iblock"
        onSelect={onSelectHistory}
        placeholder="history"
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
        placeholder="bookmarks"
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
      <Tooltip title="edit bookmarks">
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
      >setting</Button>
    </div>
  )

}
