export default function pixed (style) {
  return Object.keys(style).reduce((prev, k) => {
    const v = style[k]
    return {
      ...prev,
      [k]: isNaN(v) ? v : v + 'px'
    }
  }, {})
}
