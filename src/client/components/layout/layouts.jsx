import {
  splitConfig
} from '../../common/constants'
import LayoutItem from './layout-item'
import pixed from './pixed'

export default function LayoutWrap (props) {
  const {
    children,
    layout,
    wrapStyles,
    handleStyles,
    layoutStyle,
    handleMousedown
  } = props
  const {
    children: childrenCount,
    handle: handleCount
  } = splitConfig[layout]
  const wrapStyle = {
    className: 'layout-wrap layout-wrap-' + layout,
    style: layoutStyle
  }
  return (
    <div {...wrapStyle}>
      {
        new Array(childrenCount).fill(0).map((v, i) => {
          const itemProps = {
            i,
            style: pixed(wrapStyles[i]),
            className: 'layout-item v' + (i + 1),
            batch: i
          }
          return (
            <LayoutItem
              key={i + 'layout-item'}
              {...itemProps}
            >
              {children[i] || null}
            </LayoutItem>
          )
        })
      }
      {
        new Array(handleCount).fill(0).map((v, i) => {
          const itemProps = {
            className: 'layout-handle h' + (i + 1),
            'data-layout': layout,
            'data-index': i,
            style: handleStyles[i],
            onMouseDown: handleMousedown
          }
          return (
            <div
              key={i + 'layout-handle'}
              {...itemProps}
            />
          )
        })
      }
    </div>
  )
}
