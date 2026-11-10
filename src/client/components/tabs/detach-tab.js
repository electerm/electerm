export default function isDragOutsideWindow (event, bounds) {
  if (event.dataTransfer?.dropEffect !== 'none') {
    return false
  }
  const { screenX, screenY } = event
  const { x, y, width, height } = bounds
  return Number.isFinite(screenX) &&
    Number.isFinite(screenY) &&
    (screenX < x || screenX > x + width || screenY < y || screenY > y + height)
}
