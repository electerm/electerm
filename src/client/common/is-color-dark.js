function expandShorthandColor (color) {
  if (color.length === 4) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  }
  if (color.length === 7) {
    return color
  }
  if (color.length < 7) {
    return expandShorthandColor(color + 'f')
  }
  if (color.length > 7) {
    return expandShorthandColor(color.slice(0, 7))
  }
  if (!/^#[A-Fa-f0-9]{6}$/.test(color)) {
    return '#141314'
  }
}

export default function isColorDark (_color) {
  try {
    let color = expandShorthandColor(_color)
    if (color.charAt(0) === '#') {
      color = color.slice(1) // Remove the '#' if present
    }
    const r = parseInt(color.substr(0, 2), 16)
    const g = parseInt(color.substr(2, 2), 16)
    const b = parseInt(color.substr(4, 2), 16)

    // Formula to determine brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000

    // Decide based on brightness threshold
    return brightness < 128 // You can adjust this threshold as needed
  } catch (e) {
    return true
  }
}
