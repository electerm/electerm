function stopRowClick (event) {
  event.stopPropagation()
}

export default function ListItemActions ({ children }) {
  return (
    <div className='list-item-actions' onClick={stopRowClick} onDoubleClick={stopRowClick}>
      {children}
    </div>
  )
}
