export function formatBytes (sizeInKB) {
  if (!sizeInKB) {
    return ''
  }
  const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let index = 0

  while (sizeInKB >= 1024 && index < units.length - 1) {
    sizeInKB /= 1024
    index++
  }

  return `${sizeInKB.toFixed(2)} ${units[index]}`
}
