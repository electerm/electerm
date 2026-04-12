import React from 'react'
import { CloseCircleOutlined } from '@ant-design/icons'

const SuggestionItem = ({ item, onSelect, onDelete }) => {
  const handleClick = () => {
    onSelect(item)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    onDelete(item)
  }

  const isPassword = item.type === 'PW'
  const displayText = isPassword
    ? '••••••••'
    : item.command

  return (
    <div className='suggestion-item' onClick={handleClick}>
      <span className='suggestion-command'>
        {displayText}
      </span>
      {item.hint && (
        <span className='suggestion-hint'>
          {item.hint}
        </span>
      )}
      <span className='suggestion-type'>
        {item.type}
      </span>
      {item.type === 'H' && (
        <CloseCircleOutlined
          className='suggestion-delete'
          onClick={handleDelete}
        />
      )}
    </div>
  )
}

export default SuggestionItem
