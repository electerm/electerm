import { Component } from '../common/react-subx'
import {
  Tooltip
} from 'antd'
import InputAutoFocus from './input-auto-focus'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { paneMap, terminalActions, isMac } from '../../common/constants'
import postMessage from '../../common/post-msg'
import { MatchCaseIcon } from '../icons/match-case'
import { MatchWholWordIcon } from '../icons/match-whole-word'
import { RegularExpIcon } from '../icons/regular-exp'
import classNames from 'classnames'
import copy from 'json-deep-copy'
import keyShiftPressed from '../../common/key-shift-pressed'
import keyControlPressed from '../../common/key-control-pressed'
import keyPressed from '../../common/key-pressed'
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

  componentDidMount () {
    window.addEventListener('keydown', this.handleEvent)
  }

  componentWillUnmount () {
    window.removeEventListener('keydown', this.handleEvent)
  }

  toggleSearch = () => {
    this.props.store.toggleTerminalSearch()
    setTimeout(window.store.focus, 100)
  }

  handleEvent = (e) => {
    if (
      keyPressed(e, 'f') && keyControlPressed(e) &&
      (
        isMac ||
        (!isMac && keyShiftPressed(e))
      )
    ) {
      e.stopPropagation()
      this.toggleSearch()
    }
  }

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
    const {
      store
    } = this.props
    const v = store.termSearchOptions[prop]
    store.setTermSearchOption({
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
