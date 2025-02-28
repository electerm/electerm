import { Menu } from 'antd'
import { Component } from 'manate/react/class-components'
import { refsStatic } from '../common/ref'

export default class TerminalCmdSuggestions extends Component {
  state = {
    cursorPosition: {},
    showSuggestions: false,
    cmd: ''
  }

  componentDidMount () {
    refsStatic.add('terminal-suggestions', this)
  }

  componentWillUnmount () {
    refsStatic.remove('terminal-suggestions')
  }

  openSuggestions = (cursorPosition, cmd) => {
    // First check if there are any matching suggestions
    const suggestions = this.props.suggestions.filter(suggestion =>
      suggestion.startsWith(cmd)
    )

    // Only proceed if we have matches
    if (suggestions.length) {
      if (!this.state.showSuggestions) {
        // Add event listeners when opening
        document.addEventListener('click', this.handleClickOutside)
        document.addEventListener('keydown', this.handleKeyDown)
      }

      this.setState({
        showSuggestions: true,
        cursorPosition,
        cmd
      })
    } else {
      // No matches, make sure we're fully closed
      this.closeSuggestions()
    }
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

  handleSelect = ({ key }) => {
    window.store.autoComplete(key)
    this.closeSuggestions()
  }

  getSuggestions = () => {
    const { cmd } = this.state
    return this.props.suggestions.filter(suggestion => suggestion.startsWith(cmd))
  }

  render () {
    const { showSuggestions, cursorPosition } = this.state
    const suggestions = this.getSuggestions()
    if (!showSuggestions || !suggestions.length) {
      return null
    }

    const menuStyle = {
      left: cursorPosition.left,
      top: cursorPosition.top
    }

    const items = suggestions.map((suggestion, index) => ({
      key: suggestion,
      label: suggestion
    }))

    return (
      <Menu
        items={items}
        onClick={this.handleSelect}
        style={menuStyle}
        className='terminal-suggestions-wrap'
      />
    )
  }
}
