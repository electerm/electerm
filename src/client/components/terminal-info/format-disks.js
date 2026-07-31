/**
 * parse `df` output into disk list
 */

export default function formatDisks (str) {
  if (!str) {
    return {
      disks: []
    }
  }
  const r = str.split('\n')
    .slice(1)
    .reduce((acc, s) => {
      if (!s.trim()) {
        return acc
      }
      const arr = s.trim().split(/ +/)
      // df wraps long filesystem names (e.g. nfs "host:/very/long/export/path")
      // onto a second line that starts with spaces and only holds the numeric
      // columns. Merge such continuation lines back into the previous entry, so
      // those disks (commonly nfs) are listed instead of dropped.
      if (/^\s/.test(s) && acc.length) {
        const prev = acc[acc.length - 1]
        prev.size = arr[0]
        prev.used = arr[1]
        prev.avail = arr[2]
        prev.usedPercent = arr[3]
        prev.mount = arr[4]
        return acc
      }
      acc.push({
        filesystem: arr[0],
        size: arr[1],
        used: arr[2],
        avail: arr[3],
        usedPercent: arr[4],
        mount: arr[5]
      })
      return acc
    }, [])
    .filter(d => d.filesystem && d.mount)
  return {
    disks: r
  }
}
