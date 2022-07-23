import { Component } from '../common/react-subx'
import {
  Tooltip,
  Input
} from 'antd'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { paneMap, terminalActions } from '../../common/constants'
import postMessage from '../../common/post-msg'
import { MatchCaseIcon } from '../icons/match-case'
import { MatchWholWordIcon } from '../icons/match-whole-word'
import { RegularExpIcon } from '../icons/regular-exp'
import classNames from 'classnames'
import copy from 'json-deep-copy'
import './term-search.styl'

const { prefix } = window
const s = prefix('ssh')

export default class TermSearch extends Component {
  searchControls = [{
    id: 'matchCase',
    icon: MatchCaseIcon,
    prop: 'caseSensitive'
  }, {
    id: 'matchWholeWord',
    icon: MatchWholWordIcon,
    prop: 'wholeWord'
  }, {
    id: 'useRegExp',
    icon: RegularExpIcon,
    prop: 'regex'
  }]

  searchActions = [{
    id: 'prev',
    icon: ArrowLeftOutlined,
    cls: 'mg1l'
  }, {
    id: 'next',
    icon: ArrowRightOutlined,
    cls: 'mg1l'
  }, {
    id: 'close',
    icon: CloseCircleOutlined,
    cls: 'mg2l'
  }]

  prev = () => {
    const { activeTerminalId } = this.props.store
    postMessage({
      action: terminalActions.doSearchPrev,
      keyword: this.props.store.termSearch,
      activeSplitId: activeTerminalId,
      options: copy(this.props.store.termSearchOptions)
    })
  }

  next = () => {
    const { activeTerminalId } = this.props.store
    postMessage({
      action: terminalActions.doSearchNext,
      activeSplitId: activeTerminalId,
      keyword: this.props.store.termSearch,
      options: copy(this.props.store.termSearchOptions)
    })
  }

  handleChange = e => {
    this.props.store.termSearch = e.target.value
    this.next()
  }

  close = () => {
    this.props.store.termSearchOpen = false
  }

  renderSearchAction = item => {
    const {
      id,
      icon: Icon,
      cls
    } = item
    return (
      <Icon
        key={id}
        onClick={this[id]}
        className={'term-search-act mg1x ' + cls}
      />
    )
  }

  renderAfter = () => {
    return (
      <div>
        {
          this.searchActions.map(this.renderSearchAction)
        }
      </div>
    )
  }

  toggle = prop => {
    const v = this.props.store.termSearchOptions[prop]
    this.props.store.termSearchOptions[prop] = !v
    this.next()
  }

  renderSearchControl = (item) => {
    const {
      id,
      icon: Icon,
      prop
    } = item
    const v = this.props.store.termSearchOptions[prop]
    const cls = classNames('term-search-opt-icon', {
      'term-search-on': v
    })
    return (
      <Tooltip
        key={id}
        title={s(id)}
      >
        <Icon
          className={cls}
          onClick={() => this.toggle(prop)}
        />
      </Tooltip>
    )
  }

  renderSuffix = () => {
    return (
      <div>
        {
          this.searchControls.map(this.renderSearchControl)
        }
      </div>
    )
  }

  render () {
    const { store, currentTab } = this.props
    const {
      termSearchOpen,
      termSearch
    } = store
    if (!termSearchOpen) {
      return null
    }
    if (currentTab.pane === paneMap.fileManager) {
      return null
    }
    return (
      <div className='term-search-wrap'>
        <Input
          value={termSearch}
          className='iblock'
          onChange={this.handleChange}
          suffix={this.renderSuffix()}
          addonAfter={this.renderAfter()}
        />
      </div>
    )
  }
}
