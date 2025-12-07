import { Component } from 'manate/react/class-components'
import { refsStatic, refs } from '../common/ref'
import SuggestionItem from './cmd-item'
import { aiSuggestionsCache } from '../../common/cache'
import uid from '../../common/uid'
import classnames from 'classnames'
import {
  LoadingOutlined
} from '@ant-design/icons'

export default class TerminalCmdSuggestions extends Component {
  state = {
    cursorPosition: {},
    showSuggestions: false,
    loadingAiSuggestions: false,
    aiSuggestions: [],
    cmdIsDescription: false,
    reverse: false,
    cmd: ''
  }

  componentDidMount () {
    refsStatic.add('terminal-suggestions', this)
  }

  componentWillUnmount () {
    refsStatic.remove('terminal-suggestions')
  }

  parseAiSuggestions = (aiResponse) => {
    try {
      return JSON.parse(aiResponse.response).map(d => {
        return {
          command: d,
          type: 'AI'
        }
      })
    } catch (e) {
      console.log('parseAiSuggestions error:', e)
      return []
    }
  }

  getAiSuggestions = async (event) => {
    event.stopPropagation()
    const { cmd } = this.state
    if (window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
    }
    this.setState({
      loadingAiSuggestions: true
    })
    const {
      config
    } = window.store
    const prompt = `give me max 5 command suggestions for user input: "${cmd}", return pure json format result only, no extra words, no markdown format, follow this format: ["command1","command2"...]`
    const cached = aiSuggestionsCache.get(cmd)
    if (cached) {
      this.setState({
        loadingAiSuggestions: false,
        aiSuggestions: cached
      })
      return
    }

    const aiResponse = aiSuggestionsCache.get(prompt) || await window.pre.runGlobalAsync(
      'AIchat',
      prompt,
      config.modelAI,
      config.roleAI,
      config.baseURLAI,
      config.apiPathAI,
      config.apiKeyAI
    ).catch(
      window.store.onError
    )
    if (cmd !== this.state.cmd) {
      this.setState({
        loadingAiSuggestions: false
      })
      return
    }
    if (aiResponse && aiResponse.error) {
      this.setState({
        loadingAiSuggestions: false
      })
      return window.store.onError(
        new Error(aiResponse.error)
      )
    }
    this.setState({
      loadingAiSuggestions: false,
      aiSuggestions: this.parseAiSuggestions(aiResponse, cmd)
    })
  }

  openSuggestions = (cursorPosition, cmd) => {
    if (!this.state.showSuggestions) {
      document.addEventListener('click', this.handleClickOutside)
      document.addEventListener('keydown', this.handleKeyDown)
    }

    const {
      left,
      top,
      cellHeight
    } = cursorPosition
    const w = window.innerWidth
    const h = window.innerHeight

    const position = {}
    const reverse = top > h / 2

    // Use right position if close to right edge
    if (left > w / 2) {
      position.right = w - left
    } else {
      position.left = left
    }

    // Use bottom position if close to bottom edge
    if (reverse) {
      position.bottom = h - top + cellHeight * 1.5
    } else {
      position.top = top + cellHeight
    }
    this.setState({
      showSuggestions: true,
      cursorPosition: position,
      cmd,
      reverse
    })
  }

  closeSuggestions = () => {
    document.removeEventListener('click', this.handleClickOutside)
    document.removeEventListener('keydown', this.handleKeyDown)
    const {
      aiSuggestions
    } = this.state
    if (aiSuggestions.length) {
      aiSuggestionsCache.set(this.state.cmd, aiSuggestions)
      aiSuggestions.forEach(item => {
        window.store.addCmdHistory(item.command, 'aiCmdHistory')
      })
    }
    this.setState({
      showSuggestions: false,
      aiSuggestions: []
    })
  }

  handleClickOutside = (event) => {
    const suggestionElement = document.querySelector('.terminal-suggestions-wrap')
    if (suggestionElement && !suggestionElement.contains(event.target)) {
      this.closeSuggestions()
    }
  }

  handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      this.closeSuggestions()
    }
  }

  handleDelete = (item) => {
    window.store.terminalCommandHistory.delete(item.command)
  }

  handleSelect = (item) => {
    const { activeTabId } = window.store
    const terminal = refs.get('term-' + activeTabId)
    if (!terminal) {
      return
    }

    // const titleElement = domEvent.target.closest('.ant-menu-title-content')
    // const command = titleElement?.firstChild?.textContent
    const { command } = item
    const { cmd } = this.state
    let txt = ''
    if (cmd && command.startsWith(cmd)) {
      txt = command.slice(cmd.length)
    } else {
      const pre = '\b'.repeat(cmd.length)
      txt = pre + command
    }
    terminal.attachAddon._sendData(txt)
    terminal.term.focus()
    this.closeSuggestions()
  }

  processCommands = (commands = [], type, uniqueCommands, res) => {
    const { cmd } = this.state
    commands
      .filter(command => command && command.startsWith(cmd))
      .forEach(command => {
        if (!uniqueCommands.has(command)) {
          uniqueCommands.add(command)
          res.push({
            id: uid(),
            command,
            type
          })
        }
      })
  }

  getSuggestions = () => {
    const uniqueCommands = new Set()
    const {
      history = [],
      batch = [],
      quick = []
    } = this.props.suggestions
    const res = []
    this.state.aiSuggestions
      .forEach(item => {
        if (!uniqueCommands.has(item.command)) {
          uniqueCommands.add(item.command)
        }
        res.push({
          id: uid(),
          ...item
        })
      })
    this.processCommands(history, 'H', uniqueCommands, res)
    this.processCommands(batch, 'B', uniqueCommands, res)
    this.processCommands(quick, 'Q', uniqueCommands, res)
    return this.state.reverse ? res.reverse() : res
  }

  renderAIIcon () {
    const e = window.translate
    const {
      loadingAiSuggestions
    } = this.state
    if (loadingAiSuggestions) {
      return (
        <>
          <LoadingOutlined /> {e('getAiSuggestions')}
        </>
      )
    }
    const aiProps = {
      onClick: this.getAiSuggestions,
      className: 'pointer'
    }
    return (
      <div {...aiProps}>
        {e('getAiSuggestions')}
      </div>
    )
  }

  renderSticky (pos) {
    const {
      reverse
    } = this.state
    if (
      (pos === 'top' && !reverse) ||
      (pos === 'bottom' && reverse)
    ) {
      return null
    }
    return (
      <div className='terminal-suggestions-sticky'>
        {this.renderAIIcon()}
      </div>
    )
  }

  render () {
    const { showSuggestions, cursorPosition, reverse } = this.state
    if (!showSuggestions) {
      return null
    }
    const suggestions = this.getSuggestions()
    const cls = classnames('terminal-suggestions-wrap', {
      reverse
    })
    return (
      <div className={cls} style={cursorPosition}>
        {this.renderSticky('top')}
        <div className='terminal-suggestions-list'>
          {
            suggestions.map(item => {
              return (
                <SuggestionItem
                  key={item.id}
                  item={item}
                  onSelect={this.handleSelect}
                  onDelete={this.handleDelete}
                />
              )
            })
          }
        </div>
        {this.renderSticky('bottom')}
      </div>
    )
  }
}
