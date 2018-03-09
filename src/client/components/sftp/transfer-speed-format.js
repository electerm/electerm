/**
 * format transfer speed
 */

let m1 = 1000 * 1000
let k1 = 1000

export default (bytes, startTime) => {
  let now = +new Date()
  if (now <= startTime) {
    now = startTime + 1
  }
  let speed = bytes / ((now - startTime) / 1000)
  if (speed > m1) {
    return (speed / m1).toFixed(1) + 'MB/s'
  } else {
    return (speed / k1).toFixed(1) + 'KB/s'
  }
}
