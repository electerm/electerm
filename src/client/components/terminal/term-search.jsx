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
import { paneMap } from '../../common/constants'
import { MatchCaseIcon } from '../icons/match-case'
import { MatchWholWordIcon } from '../icons/match-whole-word'
import { RegularExpIcon } from '../icons/regular-exp'
import classNames from 'classnames'
import copy from 'json-deep-copy'
import { debounce } from 'lodash-es'
import { refsStatic, refs } from '../common/ref'
import './term-search.styl'

const e = window.translate

/**
 * A keystroke here used to run a full highlight pass, which costs
 * matches x the length of the logical line each match sits in (#4726). One
 * pass after the typing settles keeps the input responsive; Enter and the
 * prev/next arrows still search immediately.
 */
const searchDebounceMs = 150

export default class TermSearch extends PureComponent {
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

  runSearchDebounced = debounce(v => this.prev(v), searchDebounceMs)

  componentDidMount () {
    refsStatic.add('term-search', this)
  }

  componentWillUnmount () {
    this.runSearchDebounced.cancel()
  }

  toggleSearch = () => {
    const isClosing = this.props.termSearchOpen
    if (isClosing) {
      this.clearSearch()
    }
    window.store.toggleTerminalSearch()
    if (isClosing) {
      setTimeout(window.store.focus, 200)
    }
  }

  prev = (searchTerm) => {
    this.runSearchDebounced.cancel()
    const {
      activeTabId,
      termSearchOptions
    } = this.props
    refs.get('term-' + activeTabId)
      ?.searchPrev(
        typeof searchTerm === 'string' ? searchTerm : this.props.termSearch,
        copy(termSearchOptions)
      )
  }

  next = () => {
    this.runSearchDebounced.cancel()
    refs.get('term-' + this.props.activeTabId)
      ?.searchNext(
        this.props.termSearch,
        copy(this.props.termSearchOptions)
      )
  }

  handleChange = e => {
    const v = e.target.value
    window.store.termSearch = v
    if (!v) {
      // nothing to scan: clearing the highlights can happen right away
      this.runSearchDebounced.cancel()
      this.prev(v)
      return
    }
    this.runSearchDebounced(v)
  }

  clearSearch = () => {
    this.runSearchDebounced.cancel()
    const term = refs.get('term-' + this.props.activeTabId)
    term?.searchAddon.clearDecorations()
    term.setState({
      searchResults: [],
      matchIndex: -1
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
    // Only the first `highlightLimit` matches are tracked, so a search that
    // starts from the bottom (findPrevious) often selects a match outside that
    // window and the addon reports index -1. Show the count alone rather than
    // a bogus "(0/100)".
    if (termSearchMatchIndex < 0) {
      return <span className='mg1x'>({termSearchMatchCount}+)</span>
    }
    return <span className='mg1x'>({termSearchMatchIndex + 1}/{termSearchMatchCount})</span>
  }

  renderAfter = () => {
    return (
      <>
        {
          this.renderMatchData()
        }
        {
          this.searchActions.map(this.renderSearchAction)
        }
      </>
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
      <>
        {
          this.searchControls.map(this.renderSearchControl)
        }
      </>
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
      suffix: <>{this.renderSuffix()} {this.renderAfter()}</>,
      onPressEnter: this.next,
      selectall: true
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
