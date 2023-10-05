import classNames from 'classnames'

export default function SideIcon (props) {
  const {
    show,
    className,
    title = '',
    active,
    children
  } = props
  if (show === false) {
    return null
  }
  const cls = classNames(className, 'control-icon-wrap', {
    active
  })
  return (
    <div
      className={cls}
      title={title}
    >
      {children}
    </div>
  )
}
