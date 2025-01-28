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
import { refsStatic, refs } from '../common/ref'
import './term-search.styl'

const e = window.translate

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

  componentDidMount () {
    refsStatic.add('term-search', this)
  }

  toggleSearch = () => {
    if (this.props.termSearchOpen) {
      this.clearSearch()
    }
    window.store.toggleTerminalSearch()
    setTimeout(window.store.focus, 200)
  }

  prev = () => {
    const {
      activeTabId,
      termSearch,
      termSearchOptions
    } = this.props
    refs.get('term-' + activeTabId)
      ?.searchPrev(
        termSearch,
        copy(termSearchOptions)
      )
  }

  next = () => {
    refs.get('term-' + this.props.activeTabId)
      ?.searchNext(
        this.props.termSearch,
        copy(this.props.termSearchOptions)
      )
  }

  handleChange = e => {
    window.store.termSearch = e.target.value
    this.prev()
  }

  clearSearch = () => {
    refs.get('term-' + this.props.activeTabId)
      ?.searchAddon.clearDecorations()
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
