import React, { useState, useEffect, useRef } from 'react'
import { Input } from 'antd'
import './simple-editor.less' // We'll define styles later

const SimpleEditor = (props) => {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [occurrences, setOccurrences] = useState([])
  const [currentMatch, setCurrentMatch] = useState(-1)
  const editorRef = useRef(null)

  // Handle search keyword changes
  useEffect(() => {
    if (!searchKeyword) {
      setOccurrences([])
      setCurrentMatch(-1)
      return
    }
    findMatches()
  }, [searchKeyword])

  // Find all matches of the search keyword in text
  const findMatches = () => {
    const matches = []
    const text = props.value || ''
    const regex = new RegExp(searchKeyword, 'gi')
    let match
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + searchKeyword.length
      })
    }
    setOccurrences(matches)
    setCurrentMatch(matches.length ? 0 : -1)
  }

  // Navigate to next match
  const goToNextMatch = () => {
    if (currentMatch < occurrences.length - 1) {
      setCurrentMatch(currentMatch + 1)
    } else {
      setCurrentMatch(0) // Loop back to first match
    }
  }

  // Navigate to previous match
  const goToPrevMatch = () => {
    if (currentMatch > 0) {
      setCurrentMatch(currentMatch - 1)
    } else {
      setCurrentMatch(occurrences.length - 1) // Loop to last match
    }
  }

  // Highlight text with search matches
  const highlightText = () => {
    if (!searchKeyword || !occurrences.length) {
      return props.value
    }

    const text = props.value
    let result = []
    let lastIndex = 0

    occurrences.forEach((match, index) => {
      // Add text before match
      result.push(text.substring(lastIndex, match.start))
      
      // Add highlighted match
      result.push(
<span>
      {text.substring(match.start, match.end)}
</span>
  )
  
  lastIndex = match.end
})

// Add remaining text
result.push(text.substring(lastIndex))
return result
}

return (

<div>
  <div className="search-bar">
    <Input.Search
      value={searchKeyword}
      onChange={e => setSearchKeyword(e.target.value)}
      placeholder="Search in text..."
      allowClear
      addonAfter={
        occurrences.length 
          ? `${currentMatch + 1}/${occurrences.length}`
          : '0/0'
      }
    />
    {occurrences.length > 0 && (
      <div className="search-controls">
<button>
↑

</button>
<button>
↓

</button>
</div>
    )}
  </div>
<div>
    <Input.TextArea
      value={props.value}
      onChange={props.onChange}
      rows={20}
      style={{ display: searchKeyword ? 'none' : 'block' }}
    />
    {searchKeyword && (
<pre>
        {highlightText()}
</pre>
    )}
</div>
</div>
)
}

export default SimpleEditor