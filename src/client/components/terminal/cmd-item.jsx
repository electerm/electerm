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

  return (
    <div className='suggestion-item'>
      <span className='suggestion-command' onClick={handleClick}>
        {item.command}
      </span>
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
