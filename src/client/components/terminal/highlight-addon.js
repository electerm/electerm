export class KeywordHighlighterAddon {
  constructor (keywords) {
    this.keywords = keywords
  }

  escape = str => {
    return str.replace(/\\x1B/g, '\\x1B')
      .replace(/\033/g, '\\033')
  }

  colorize = (color) => {
    // Use a switch statement to map color names to ANSI codes
    switch (color) {
      case 'green':
        return '\u001b[32m$&\u001b[0m'
      case 'yellow':
        return '\u001b[33m$&\u001b[0m'
      case 'blue':
        return '\u001b[34m$&\u001b[0m'
      case 'magenta':
        return '\u001b[35m$&\u001b[0m'
      case 'cyan':
        return '\u001b[36m$&\u001b[0m'
      case 'white':
        return '\u001b[37m$&\u001b[0m'
      default:
        return '\u001b[31m$&\u001b[0m'
    }
  }

  highlightKeywords = (text) => {
    for (const obj of this.keywords) {
      const {
        keyword,
        color = 'red'
      } = obj || {}
      if (keyword) {
        try {
          const regex = new RegExp(`(${keyword})`, 'gi')
          if (regex.test(text)) {
            return text.replace(regex, this.colorize(color))
          }
        } catch (e) {
          window.store.onError(e)
        }
      }
    }
    return text
  }

  activate (terminal) {
    this.terminal = terminal
    // Override the write method to automatically highlight keywords
    const originalWrite = terminal.write
    terminal.write = (data) => {
      originalWrite.call(
        terminal,
        terminal.displayRaw ? this.escape(data) : this.highlightKeywords(data)
      )
    }
    this.originalWrite = originalWrite
  }

  dispose () {
    // Restore the original write method when disposing the addon
    this.terminal.write = this.originalWrite
    this.originalWrite = null
    this.term = null
  }
}
