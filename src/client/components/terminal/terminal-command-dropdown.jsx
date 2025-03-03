import { Component } from 'manate/react/class-components'
import { refsStatic, refs } from '../common/ref'
import SuggestionItem from './cmd-item'
import uid from '../../common/uid'
import {
  LoadingOutlined
} from '@ant-design/icons'

export default class TerminalCmdSuggestions extends Component {
  state = {
    cursorPosition: {},
    showSuggestions: false,
    loadingAiSuggestions: false,
    aiSuggestions: [],
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
    const prompt = `give me max 5 command suggestions for user input: "${cmd}", return pure json format result only, no extra words, no md format, follow this format: ["command1","command2"...]`
    const aiResponse = await window.pre.runGlobalAsync(
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
      aiSuggestions: this.parseAiSuggestions(aiResponse)
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

    // Use right position if close to right edge
    if (left > w / 2) {
      position.right = w - left
    } else {
      position.left = left
    }

    // Use bottom position if close to bottom edge
    if (top > h / 2) {
      position.bottom = h - top + cellHeight
    } else {
      position.top = top
    }

    console.log('openSuggestions', position)

    this.setState({
      showSuggestions: true,
      cursorPosition: position,
      cmd
    })
  }

  closeSuggestions = () => {
    // Only remove listeners if we were showing suggestions
    if (this.state.showSuggestions) {
      document.removeEventListener('click', this.handleClickOutside)
      document.removeEventListener('keydown', this.handleKeyDown)

      this.setState({
        showSuggestions: false
      })
    }
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

  processCommands = (commands, type, uniqueCommands, res) => {
    const { cmd } = this.state
    commands
      .filter(command => command.startsWith(cmd))
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
    this.processCommands(history, 'H', uniqueCommands, res)
    this.processCommands(batch, 'B', uniqueCommands, res)
    this.processCommands(quick, 'Q', uniqueCommands, res)
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

    return res
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

  render () {
    const { showSuggestions, cursorPosition } = this.state
    if (!showSuggestions) {
      return null
    }
    const suggestions = this.getSuggestions()
    return (
      <div className='terminal-suggestions-wrap' style={cursorPosition}>
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
        <div className='terminal-suggestions-sticky'>
          {this.renderAIIcon()}
        </div>
      </div>
    )
  }
}
