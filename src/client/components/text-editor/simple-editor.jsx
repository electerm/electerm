import React, { useState, useEffect, useRef } from 'react'
import { Input, Button, Flex } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  SearchOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { copy } from '../../common/clipboard'

export default function SimpleEditor (props) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [occurrences, setOccurrences] = useState([])
  const [currentMatch, setCurrentMatch] = useState(-1)
  const [isNavigating, setIsNavigating] = useState(false)
  const editorRef = useRef(null)

  // When currentMatch changes, highlight the match in textarea
  useEffect(() => {
    if (currentMatch >= 0 && occurrences.length > 0) {
      const match = occurrences[currentMatch]
      if (editorRef.current) {
        // Set selection range to select the matched text
        editorRef.current.resizableTextArea.textArea.setSelectionRange(match.start, match.end)

        // Only focus the textarea when explicitly navigating between matches
        if (isNavigating) {
          editorRef.current.resizableTextArea.textArea.focus()
        }

        // Scroll to the selection position
        const textarea = editorRef.current.resizableTextArea.textArea
        const textBeforeSelection = props.value.substring(0, match.start)
        const lineBreaks = textBeforeSelection.split('\n').length - 1

        // Estimate the scroll position
        const lineHeight = 20 // Approximate line height in pixels
        const scrollPosition = lineHeight * lineBreaks

        textarea.scrollTop = Math.max(0, scrollPosition - textarea.clientHeight / 2)
      }
    }
    // Reset navigating flag after using it
    setIsNavigating(false)
  }, [currentMatch, occurrences])
  // Copy the editor content to clipboard
  const copyEditorContent = () => {
    copy(props.value || '')
  }

  // Find all matches of the search keyword in text
  const findMatches = () => {
    if (!searchKeyword) {
      setOccurrences([])
      setCurrentMatch(-1)
      return
    }

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

  // Handle search action when user presses enter or clicks the search button
  const handleSearch = (e) => {
    e.stopPropagation()
    e.preventDefault()
    findMatches()
  }

  // Navigate to next match
  const goToNextMatch = () => {
    setIsNavigating(true)
    if (currentMatch < occurrences.length - 1) {
      setCurrentMatch(currentMatch + 1)
    } else {
      setCurrentMatch(0) // Loop back to first match
    }
  }

  // Navigate to previous match
  const goToPrevMatch = () => {
    setIsNavigating(true)
    if (currentMatch > 0) {
      setCurrentMatch(currentMatch - 1)
    } else {
      setCurrentMatch(occurrences.length - 1) // Loop to last match
    }
  }

  // Render navigation buttons for search results
  const renderNavigationButtons = () => {
    if (occurrences.length === 0) {
      return null
    }
    return (
      <>
        <Button onClick={goToPrevMatch}>
          <ArrowUpOutlined />
        </Button>
        <Button onClick={goToNextMatch}>
          <ArrowDownOutlined />
        </Button>
      </>
    )
  }

  // Render search results counter
  const renderSearchCounter = () => {
    return occurrences.length
      ? `${currentMatch + 1}/${occurrences.length}`
      : '0/0'
  }

  function renderAfter () {
    return (
      <>
        <b className='pd1x'>{renderSearchCounter()}</b>
        {renderNavigationButtons()}
      </>
    )
  }

  return (
    <div>
      <Flex className='mg1b' justify='space-between'>
        <Input.Search
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          placeholder='Search in text...'
          allowClear
          enterButton={<SearchOutlined />}
          onSearch={handleSearch}
          onPressEnter={handleSearch}
          addonAfter={renderAfter()}
          style={{ width: 'auto' }}
        />
        <Button
          onClick={copyEditorContent}
          className='mg3l'
        >
          <CopyOutlined />
        </Button>
      </Flex>
      <Input.TextArea
        ref={editorRef}
        value={props.value}
        onChange={props.onChange}
        rows={20}
      />
    </div>

  )
}
