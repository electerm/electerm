import React, { useState, useRef, useEffect } from 'react'
import { Tooltip, Input } from 'antd'
import {
  FilterOutlined,
  CheckOutlined
} from '@ant-design/icons'
import classnames from 'classnames'

const e = window.translate

export default function KeywordFilter ({ keyword, type, updateKeyword }) {
  const [text, setText] = useState(keyword)
  const inputRef = useRef(null)

  useEffect(() => {
    setText(keyword)
  }, [keyword])

  const handleInputChange = (e) => {
    setText(e.target.value)
  }

  const applyFilter = () => {
    updateKeyword(text, type)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      applyFilter()
    }
  }

  const iconClass = classnames('keyword-filter-icon mg1r', {
    active: !!keyword
  })

  const inputProps = {
    value: text,
    onChange: handleInputChange,
    addonBefore: <FilterOutlined />,
    onKeyPress: handleKeyPress,
    placeholder: e('keyword'),
    className: 'keyword-filter-input',
    addonAfter: <CheckOutlined onClick={applyFilter} />
  }

  const tooltipContent = (
    <Input
      {...inputProps}
      ref={inputRef}
    />
  )

  if (!updateKeyword) {
    return null
  }

  return (
    <Tooltip title={tooltipContent} trigger='click'>
      <FilterOutlined className={iconClass} />
    </Tooltip>
  )
}
