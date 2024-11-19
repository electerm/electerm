export default function LayoutItem (props) {
  const {
    children,
    i,
    ...itemProps
  } = props
  function handleClick () {
    window.store.currentLayoutBatch = i
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
