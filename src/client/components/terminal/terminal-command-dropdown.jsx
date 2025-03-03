import { Menu } from 'antd'
import { Component } from 'manate/react/class-components'
import { refsStatic, refs } from '../common/ref'
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
          type: 'ai'
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
      // Add event listeners when opening
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
    const ddw = 300
    const ddh = 300
    let l = left
    let t = top
    if (left + ddw > w) {
      l = left - ddw
    }
    if (top + ddh > h) {
      t = top - ddh - cellHeight
    }

    this.setState({
      showSuggestions: true,
      cursorPosition: {
        left: l,
        top: t
      },
      cmd
    })
  }

  closeSuggestions = () => {
    // Only remove listeners if we were showing suggestions
    if (this.state.showSuggestions) {
      console.log('ddd')
      document.removeEventListener('click', this.handleClickOutside)
      document.removeEventListener('keydown', this.handleKeyDown)

      this.setState({
        showSuggestions: false
      })
    }
  }

  handleClickOutside = (event) => {
    const suggestionElement = document.querySelector('.terminal-suggestions-wrap')
    console.log(event.target, 'event.target')
    if (suggestionElement && !suggestionElement.contains(event.target)) {
      this.closeSuggestions()
    }
  }

  handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      this.closeSuggestions()
    }
  }

  handleSelect = ({ domEvent }) => {
    const { activeTabId } = window.store
    const terminal = refs.get('term-' + activeTabId)
    if (!terminal) {
      console.log('no terminal')
      return
    }

    // const titleElement = domEvent.target.closest('.ant-menu-title-content')
    // const command = titleElement?.firstChild?.textContent
    const command = domEvent.target.firstChild.textContent
    console.log(command, 'command')
    const { cmd } = this.state
    if (cmd && command.startsWith(cmd)) {
      const remainingText = command.slice(cmd.length)
      terminal.attachAddon._sendData(remainingText)
    } else {
      const pre = '\b'.repeat(cmd.length)
      terminal.attachAddon._sendData(pre + command)
    }
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
    console.log(this.props.suggestions, 'suggestions0')
    // Process all command types
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
    const menuStyle = {
      left: cursorPosition.left,
      top: cursorPosition.top
    }

    const items = suggestions.map((item, index) => {
      const c = item.command
      return {
        key: item.id,
        label: c,
        extra: item.type,
        title: c
      }
    })

    return (
      <div className='terminal-suggestions-wrap' style={menuStyle}>
        <div className='terminal-suggestions-list'>
          <Menu
            items={items}
            onClick={this.handleSelect}
          />
        </div>
        <div className='terminal-suggestions-sticky'>
          {this.renderAIIcon()}
        </div>
      </div>
    )
  }
}
