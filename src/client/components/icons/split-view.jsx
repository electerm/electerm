import Icon from '@ant-design/icons'

// from https://icon-sets.iconify.design/codicon/case-sensitive/
const splitViewSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 16 16'>
    <rect x='1' y='1' width='14' height='14' stroke='currentColor' strokeWidth='1' fill='none' />
    <line x1='8' y1='1' x2='8' y2='15' stroke='currentColor' strokeWidth='1' />
    <polyline points='3,5 5,7 3,9' stroke='currentColor' strokeWidth='1' fill='none' />
    <path d='M9 4H14V12H9V4Z' stroke='currentColor' strokeWidth='1' fill='none' />
    <path d='M9 6H14' stroke='currentColor' strokeWidth='1' />
  </svg>
)

export const SplitViewIcon = props => (<Icon component={splitViewSvg} {...props} />)
