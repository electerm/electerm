/**
 * format transfer speed
 */

let m1 = 1000 * 1000
let k1 = 1000
let sec = 1000
let minute = sec * 60
let hour = minute * 60
let day = hour * 24
let month = day * 30

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

export const leftTime = (bytes, total, startTime) => {
  let now = +new Date()
  if (now <= startTime) {
    now = startTime + 1
  }
  let speed = bytes / (now - startTime)
  let allTimeNeed = (total - bytes) / speed
  let d = Math.floor(allTimeNeed / day)
  let h = Math.floor((allTimeNeed - d * day) / hour)
  let m = Math.floor((allTimeNeed - d * day - h * hour) / minute)
  let s = Math.floor((allTimeNeed - d * day - h * hour - m * minute) / sec)
  if (allTimeNeed > month) {
    return '>30d'
  } else if (allTimeNeed > day) {
    return `${d}d ${h}:${m}:${s}`
  } else if (allTimeNeed > hour) {
    return `${h}:${m}:${s}`
  } else if (allTimeNeed > minute) {
    return `${m}:${s}`
  }
} 
