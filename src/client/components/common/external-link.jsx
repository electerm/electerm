/**
 * external link, will be opened with default browser
 */

function onClick(e, href) {
  e.preventDefault()
  window.getGlobal('openExternal')(href)
}

export default (props) => {
  let {to, children, ...rest} = props
  return (
    <a
      href={to}
      onClick={e => onClick(e, to)}
      {...rest}
    >
      {children}
    </a>
  )
}
