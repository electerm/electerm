import Icon from '@ant-design/icons'

const singleSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
  </svg>
)

// Two Columns (c2)
const twoColumnsSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
    <line x1='12' y1='2' x2='12' y2='22' stroke='currentColor' stroke-width='2' />
  </svg>
)

// Three Columns (c3)
const threeColumnsSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
    <line x1='8' y1='2' x2='8' y2='22' stroke='currentColor' stroke-width='2' />
    <line x1='16' y1='2' x2='16' y2='22' stroke='currentColor' stroke-width='2' />
  </svg>
)

// Two Rows (r2)
const twoRowsSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
    <line x1='2' y1='12' x2='22' y2='12' stroke='currentColor' stroke-width='2' />
  </svg>
)

// Three Rows (r3)
const threeRowsSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
    <line x1='2' y1='8' x2='22' y2='8' stroke='currentColor' stroke-width='2' />
    <line x1='2' y1='16' x2='22' y2='16' stroke='currentColor' stroke-width='2' />
  </svg>
)

// Grid 2x2 (2x2)
const grid2x2Svg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
    <line x1='12' y1='2' x2='12' y2='22' stroke='currentColor' stroke-width='2' />
    <line x1='2' y1='12' x2='22' y2='12' stroke='currentColor' stroke-width='2' />
  </svg>
)

// Two Rows Right (1x2r)
const twoRowsRightSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
    <line x1='12' y1='2' x2='12' y2='22' stroke='currentColor' stroke-width='2' />
    <line x1='12' y1='12' x2='22' y2='12' stroke='currentColor' stroke-width='2' />
  </svg>
)

// Two Columns Bottom (1x1c)
const twoColumnsBottomSvg = () => (
  <svg width='1em' height='1em' viewBox='0 0 24 24'>
    <rect x='2' y='2' width='20' height='20' fill='none' stroke='currentColor' stroke-width='2' />
    <line x1='2' y1='12' x2='22' y2='12' stroke='currentColor' stroke-width='2' />
    <line x1='12' y1='12' x2='12' y2='22' stroke='currentColor' stroke-width='2' />
  </svg>
)

export const SingleIcon = props => (<Icon component={singleSvg} {...props} />)
export const TwoColumnsIcon = props => (<Icon component={twoColumnsSvg} {...props} />)
export const ThreeColumnsIcon = props => (<Icon component={threeColumnsSvg} {...props} />)
export const TwoRowsIcon = props => (<Icon component={twoRowsSvg} {...props} />)
export const ThreeRowsIcon = props => (<Icon component={threeRowsSvg} {...props} />)
export const Grid2x2Icon = props => (<Icon component={grid2x2Svg} {...props} />)
export const TwoRowsRightIcon = props => (<Icon component={twoRowsRightSvg} {...props} />)
export const TwoColumnsBottomIcon = props => (<Icon component={twoColumnsBottomSvg} {...props} />)
