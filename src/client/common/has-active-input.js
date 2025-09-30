export default function hasActiveInput (className = 'ant-input-search') {
  const activeElement = document.activeElement
  const isInput = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA'
  )
  const hasClass = className ? activeElement.classList.contains(className) : true
  const hasInputDropDown = document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)')
  return (isInput && hasClass) || hasInputDropDown
}
