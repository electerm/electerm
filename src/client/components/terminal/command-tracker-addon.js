export class CommandTrackerAddon {
  constructor () {
    this.terminal = undefined
    this.currentCommand = ''
    this.prevCommand = ''
    this.cursorPosition = 0
  }

  activate (terminal) {
    this.terminal = terminal
    this.terminal.onData(this.handleData)
    this.terminal.onKey(this.handleKey)
  }

  dispose () {
    // Clean up event listeners if necessary
  }

  handleData = (data) => {
    // Handle regular input
    this.currentCommand = this.currentCommand.slice(0, this.cursorPosition) + data + this.currentCommand.slice(this.cursorPosition)
    this.cursorPosition += data.length
  }

  handleKey = (e) => {
    const key = e.domEvent.key

    if (key === 'Enter') {
      // Command executed, reset
      this.prevCommand = this.currentCommand
      this.currentCommand = ''
      this.cursorPosition = 0
    } else if (key === 'Backspace') {
      // Handle backspace
      if (this.cursorPosition > 0) {
        this.currentCommand = this.currentCommand.slice(0, this.cursorPosition - 1) + this.currentCommand.slice(this.cursorPosition)
        this.cursorPosition--
      }
    } else if (key === 'ArrowLeft') {
      // Move cursor left
      if (this.cursorPosition > 0) {
        this.cursorPosition--
      }
    } else if (key === 'ArrowRight') {
      // Move cursor right
      if (this.cursorPosition < this.currentCommand.length) {
        this.cursorPosition++
      }
    }
    // Add more key handlers as needed
  }

  getCurrentCommand () {
    return this.prevCommand
  }
}
