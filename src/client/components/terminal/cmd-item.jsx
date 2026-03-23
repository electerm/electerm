import React from 'react'
import { XCircle } from 'lucide-react'

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
        <XCircle
          className='suggestion-delete'
          onClick={handleDelete}
        />
      )}
    </div>
  )
}

export default SuggestionItem
