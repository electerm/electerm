import './ai-icon.styl'

export default function AIIcon (props) {
  const {
    className,
    ...rest
  } = props
  const cls = 'ai-icon' + (props.className ? ' ' + props.className : '')
  return (
    <span
      className={cls}
      {...rest}
    >
      AI
    </span>
  )
}
