import { memo } from 'react'
import {
  splitConfig
} from '../../common/constants'

function pixed (style) {
  return Object.keys(style).reduce((prev, k) => {
    const v = style[k]
    return {
      ...prev,
      [k]: v + 'px'
    }
  }, {})
}

export default memo(function LayoutWrap (props) {
  const {
    children,
    layout,
    wrapStyles,
    handleStyles,
    layoutStyle,
    handleMousedown
  } = props
  console.log('layout', layout)
  const {
    children: childrenCount,
    handle: handleCount
  } = splitConfig[layout]
  const wrapStyle = {
    className: 'layout-wrap layout-wrap-' + layout,
    style: pixed(layoutStyle)
  }
  console.log('wrapStyles', wrapStyles)
  return (
    <div {...wrapStyle}>
      {
        new Array(childrenCount).fill(0).map((v, i) => {
          const itemProps = {
            style: wrapStyles[i],
            className: 'layout-item v' + (i + 1)
          }
          console.log('itemProps', itemProps)
          return (
            <div
              key={i + 'layout-item'}
              {...itemProps}
            >
              {children[i] || null}
            </div>
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
})
