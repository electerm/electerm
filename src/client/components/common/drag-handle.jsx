import {
  Splitter
} from 'antd'
import './drag-handle.styl'

const {
  Panel
} = Splitter

export default function DragHandle (props) {
  const {
    max,
    min,
    width,
    left = true
  } = props

  const divProps = {
    className: 'drag-handle'
  }
  const w = max * 2
  function newSize (sizes) {
    return left ? sizes[0] : sizes[1]
  }
  function onResizeEnd (sizes) {
    props.onDragEnd(newSize(sizes))
  }
  function onResize (sizes) {
    props.onDragEnd(newSize(sizes))
  }

  const l = left ? -width : -(w - width)
  const r = left ? w - width : width
  const splitProps = {
    // lazy: true,
    onResizeEnd,
    onResize,
    style: {
      width: w + 'px',
      position: 'absolute',
      left: l + 'px',
      right: r + 'px',
      top: 0,
      bottom: 0
    }
  }
  const panelPropsL = {
    min,
    max,
    size: width
  }
  const panelPropsR = {
    min: max,
    max: w - min,
    size: w - width
  }
  const panelPropsLeft = left
    ? panelPropsL
    : panelPropsR
  return (
    <div
      {...divProps}
    >
      <Splitter
        {...splitProps}
      >
        <Panel
          {...panelPropsLeft}
        />
        <Panel />
      </Splitter>
    </div>
  )
}
