export default function pixed (style) {
  if (!style || typeof style !== 'object') {
    return {}
  }
  return Object.keys(style).reduce((prev, k) => {
    const v = style[k]
    return {
      ...prev,
      [k]: isNaN(v) ? v : v + 'px'
    }
  }, {})
}
