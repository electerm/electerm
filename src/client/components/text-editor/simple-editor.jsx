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
        const textarea = editorRef.current.resizableTextArea.textArea

        // Set selection range to select the matched text
        textarea.setSelectionRange(match.start, match.end)

        // Only focus the textarea when explicitly navigating between matches
        if (isNavigating) {
          textarea.focus()
        }

        // Scroll to the selection position
        // Use setTimeout to ensure the selection is rendered before scrolling
        setTimeout(() => {
          const textBeforeSelection = props.value.substring(0, match.start)
          const lineBreaks = textBeforeSelection.split('\n').length - 1

          // Estimate the scroll position
          const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20
          const scrollPosition = lineHeight * lineBreaks

          // Scroll to center the match, but ensure we can scroll to the bottom
          const targetScroll = scrollPosition - textarea.clientHeight / 2
          const maxScroll = textarea.scrollHeight - textarea.clientHeight

          textarea.scrollTop = Math.max(0, Math.min(targetScroll, maxScroll))
        }, 0)
      }
    }
    // Reset navigating flag after using it
    setIsNavigating(false)
  }, [currentMatch, occurrences])

  // Auto-search when keyword changes
  useEffect(() => {
    findMatches()
  }, [searchKeyword, props.value])

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
    if (e && e.stopPropagation) {
      e.stopPropagation()
      e.preventDefault()
    }
    findMatches()
    goToNextMatch()
  }

  function handleChange (e) {
    setSearchKeyword(e.target.value)
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
          onChange={handleChange}
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
