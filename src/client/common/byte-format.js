export function formatBytes (bytes) {
  if (!bytes) {
    return ''
  }

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const formattedBytes = (bytes / Math.pow(1024, i)).toFixed(2)

  return `${formattedBytes} ${sizes[i]}`
}
