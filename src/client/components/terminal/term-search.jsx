import { PureComponent } from 'react'
import {
  Tooltip
} from 'antd'
import InputAutoFocus from '../common/input-auto-focus'
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
import { shortcutExtend } from '../shortcuts/shortcut-handler.js'
import './term-search.styl'

const e = window.translate

class TermSearch extends PureComponent {
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

  componentDidMount () {
    window.addEventListener('keydown', this.handleKeyboardEvent.bind(this))
  }

  toggleSearch = () => {
    if (this.props.termSearchOpen) {
      this.clearSearch()
    }
    window.store.toggleTerminalSearch()
    setTimeout(window.store.focus, 200)
  }

  searchShortcut = (e) => {
    e.stopPropagation()
    this.toggleSearch()
  }

  prev = () => {
    const {
      activeTabId,
      termSearch,
      termSearchOptions
    } = this.props
    postMessage({
      action: terminalActions.doSearchPrev,
      keyword: termSearch,
      activeTabId,
      options: copy(termSearchOptions)
    })
  }

  next = () => {
    postMessage({
      action: terminalActions.doSearchNext,
      activeTabId: this.props.activeTabId,
      keyword: this.props.termSearch,
      options: copy(this.props.termSearchOptions)
    })
  }

  handleChange = e => {
    window.store.termSearch = e.target.value
    this.prev()
  }

  clearSearch = () => {
    postMessage({
      action: terminalActions.clearSearch,
      activeTabId: this.props.activeTabId
    })
  }

  close = () => {
    this.clearSearch()
    window.store.termSearchOpen = false
  }

  renderSearchAction = item => {
    const {
      id,
      icon: Icon,
      cls
    } = item
    const props = {
      onClick: this[id],
      className: 'term-search-act mg1x ' + cls
    }
    return (
      <Icon
        key={id}
        {...props}
      />
    )
  }

  renderMatchData = () => {
    const {
      termSearchMatchCount,
      termSearchMatchIndex
    } = this.props
    if (!termSearchMatchCount) {
      return null
    }
    return <span className='mg1x'>({termSearchMatchIndex + 1}/{termSearchMatchCount})</span>
  }

  renderAfter = () => {
    return (
      <div>
        {
          this.renderMatchData()
        }
        {
          this.searchActions.map(this.renderSearchAction)
        }
      </div>
    )
  }

  toggle = prop => {
    const {
      termSearchOptions
    } = this.props
    const v = termSearchOptions[prop]
    window.store.setTermSearchOption({
      [prop]: !v
    })
    this.next()
  }

  renderSearchControl = (item) => {
    const {
      id,
      icon: Icon,
      prop
    } = item
    const v = this.props.termSearchOptions[prop]
    const cls = classNames('term-search-opt-icon', {
      'term-search-on': v
    })
    return (
      <Tooltip
        key={id}
        title={e(id)}
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
    const {
      termSearchOpen,
      termSearch,
      currentTab
    } = this.props
    if (
      !termSearchOpen ||
      !currentTab ||
      currentTab.pane === paneMap.fileManager
    ) {
      return null
    }
    const props = {
      value: termSearch,
      className: 'iblock',
      onChange: this.handleChange,
      suffix: this.renderSuffix(),
      onPressEnter: this.next,
      addonAfter: this.renderAfter()
    }
    return (
      <div className='term-search-wrap'>
        <InputAutoFocus
          {...props}
        />
      </div>
    )
  }
}

export default shortcutExtend(TermSearch)
