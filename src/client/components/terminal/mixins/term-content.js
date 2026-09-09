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
  }
}
