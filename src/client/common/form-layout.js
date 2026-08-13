/**
 * form layout
 */

// Labels sit on top, left-aligned, so every field shares one left edge.
// Full-span label/wrapper is what makes Form layout='vertical' render cleanly;
// the previous sm:8 / sm:16 split reserved a third of the pane for a
// right-aligned label channel that was mostly empty.
export const formItemLayout = {
  labelCol: {
    span: 24
  },
  wrapperCol: {
    span: 24
  }
}

export const tailFormItemLayout = {
  wrapperCol: {
    span: 24,
    offset: 0
  }
}
