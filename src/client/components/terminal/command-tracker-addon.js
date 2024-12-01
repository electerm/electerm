export class CommandTrackerAddon {
  constructor () {
    this.terminal = undefined
    this.activeCommand = ''
    this.currentCommand = ''
    this.cursorPosition = 0
    this.timeout = null
    this.handleKey = this.debounce(this._handleKey, 200) // 10ms debounce
  }

  debounce = (func, wait) => {
    return (...args) => {
      const later = () => {
        clearTimeout(this.timeout)
        func.apply(this, args)
      }

      clearTimeout(this.timeout)
      this.timeout = setTimeout(later, wait)
    }
  }

  activate (terminal) {
    this.terminal = terminal
  }

  dispose () {
    this.term = null
    if (this._disposables) {
      this._disposables.forEach(d => d.dispose())
      this._disposables.length = 0
    }
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  handleData = (data) => {
    // Handle regular input
    this.activeCommand = this.activeCommand.slice(0, this.cursorPosition) + data + this.activeCommand.slice(this.cursorPosition)
    this.cursorPosition += data.length
  }

  // This is now our internal handler
  _handleKey = (e) => {
    const { key } = e
    if (key === 'Enter') {
      // Command executed, reset
      this.currentCommand = this.activeCommand
      this.activeCommand = ''
      this.cursorPosition = 0
    } else if (key === 'Backspace') {
      // Handle backspace
      if (this.cursorPosition > 0) {
        this.activeCommand = this.activeCommand.slice(0, this.cursorPosition - 1) + this.activeCommand.slice(this.cursorPosition)
        this.cursorPosition--
      }
    } else if (key === 'ArrowLeft') {
      // Move cursor left
      if (this.cursorPosition > 0) {
        this.cursorPosition--
      }
    } else if (key === 'ArrowRight') {
      // Move cursor right
      if (this.cursorPosition < this.activeCommand.length) {
        this.cursorPosition++
      }
    }
  }

  getCurrentCommand () {
    return this.activeCommand || this.currentCommand
  }
}
