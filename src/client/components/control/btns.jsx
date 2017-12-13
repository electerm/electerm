/**
 * btns
 */

import {Button, Select, Icon, Tooltip, Modal} from 'antd'
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
      <div className="fright line-height28">
        <Icon
          type="reload"
          className="pointer mg1x font14"
          title="reload"
          onClick={() => location.reload()}
        />
        <Icon
          type="info-circle-o"
          title="about"
          className="pointer mg1l mg2r font14"
          onClick={openAbout}
        />
      </div>
    </div>
  )

}
