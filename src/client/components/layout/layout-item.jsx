export default function LayoutItem (props) {
  const {
    children,
    i,
    ...itemProps
  } = props
  function handleClick (e) {
    let currentElement = e.target
    while (currentElement) {
      if (currentElement.classList && currentElement.classList.contains('tabs-dd-icon')) {
        return false
      }
      currentElement = currentElement.parentElement
    }

    window.StorageEvent.currentLayoutBatch = i
  }
  return (
    <div
      {...itemProps}
      onClick={handleClick}
    >
      {children}
    </div>
  )
}
