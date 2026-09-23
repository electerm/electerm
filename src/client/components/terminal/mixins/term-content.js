/**
 * Reading back what is on screen: search (xterm search addon + the result
 * bar), the normal-buffer overlay used when an app owns the alt buffer, and
 * plain text export of the current buffer.
 */
export const contentMixin = {
  toggleSearch () {
    window.store.toggleTerminalSearch()
  },

  onSearchResultsChange ({ resultIndex, resultCount }) {
    window.store.storeAssign({
      termSearchMatchCount: resultCount,
      termSearchMatchIndex: resultIndex
    })

    this.updateSearchResults(resultIndex)
  },

  updateSearchResults (resultIndex) {
    const matches = this.searchAddon._resultTracker.searchResults.map((result, i) => {
      return result.row
    })

    this.setState({
      searchResults: matches,
      matchIndex: resultIndex,
      totalLines: this.term.buffer.active.length
    })
  },

  searchPrev (searchInput, options) {
    this.searchAddon.findPrevious(
      searchInput, options
    )
  },

  searchNext (searchInput, options) {
    this.searchAddon.findNext(
      searchInput, options
    )
  },

  openNormalBuffer () {
    const normal = this.term.buffer.normal
    const len = normal.length
    const lines = new Array(len).fill('').map((x, i) => {
      return normal.getLine(i).translateToString(false)
    })
    this.setState({
      lines
    })
  },

  closeNormalBuffer () {
    this.setState({
      lines: []
    })
    this.term.focus()
  },

  onBufferChange (buf) {
    this.bufferMode = buf.type
  },

  getTerminalBufferText () {
    const { addTimeStampToTermLog } = this.state
    const buffer = this.term.buffer.active
    const len = buffer.length
    const rawLines = []
    for (let i = 0; i < len; i++) {
      const line = buffer.getLine(i)
      rawLines.push(line ? line.translateToString(false) : '')
    }
    // trim trailing blank lines before applying timestamps
    while (rawLines.length && !rawLines[rawLines.length - 1].trim()) {
      rawLines.pop()
    }
    if (!addTimeStampToTermLog) {
      return rawLines.join('\n')
    }
    return rawLines.map(text => {
      const now = new Date()
      const ts = `[${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}] `
      return ts + text
    }).join('\n')
  },

  /**
   * The whole buffer as clean plain text, for the touch select-text overlay.
   *
   * Differs from getTerminalBufferText() on purpose: that one is for log files
   * and keeps xterm's fixed-width padding (`translateToString(false)`), which
   * would trail a screen-full of spaces into a textarea and make every line
   * look wrapped. Here each row is right-trimmed, rows xterm reports as
   * `isWrapped` are glued back so a line the shell printed as one line is
   * copied as one line, and the blank rows scrollback starts out with are
   * dropped so the panel opens on real output.
   */
  getSelectableBufferText () {
    const buffer = this.term.buffer.active
    const len = buffer.length
    const lines = []
    for (let i = 0; i < len; i++) {
      const line = buffer.getLine(i)
      if (!line) {
        continue
      }
      const text = line.translateToString(true)
      if (line.isWrapped && lines.length) {
        lines[lines.length - 1] += text
      } else {
        lines.push(text)
      }
    }
    let start = 0
    let end = lines.length
    while (start < end && !lines[start].trim()) {
      start++
    }
    while (end > start && !lines[end - 1].trim()) {
      end--
    }
    return lines.slice(start, end).join('\n')
  }
}
