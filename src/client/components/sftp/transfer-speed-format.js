/**
 * format transfer speed
 */

const m1 = 1000 * 1000
const k1 = 1000
const sec = 1000
const minute = sec * 60
const hour = minute * 60
const day = hour * 24
const month = day * 30

export default (bytes, startTime) => {
  let now = +new Date()
  if (now <= startTime) {
    now = startTime + 1
  }
  const speed = bytes / ((now - startTime) / 1000)
  if (speed > m1) {
    return (speed / m1).toFixed(1) + 'MB/s'
  } else {
    return (speed / k1).toFixed(1) + 'KB/s'
  }
}

function formatTime (ms) {
  const d = Math.floor(ms / day)
  const h = Math.floor((ms - d * day) / hour)
  const m = Math.floor((ms - d * day - h * hour) / minute)
  const s = Math.floor((ms - d * day - h * hour - m * minute) / sec)
  if (ms > month) {
    return '>30d'
  } else if (ms > day) {
    return `${d}d ${h}:${m}:${s}`
  } else if (ms > hour) {
    return `${h}:${m}:${s}`
  } else if (ms > minute) {
    return `${m}:${s}`
  } else {
    return Math.floor(ms / 1000) + 's'
  }
}

export const computePassedTime = (startTime) => {
  const allTimeNeed = (+new Date()) - startTime
  return formatTime(allTimeNeed)
}

export const computeLeftTime = (bytes, total, startTime) => {
  let now = +new Date()
  if (now <= startTime) {
    now = startTime + 1
  }
  const speed = bytes / (now - startTime)
  const allTimeNeed = (total - bytes) / speed
  return {
    leftTime: formatTime(allTimeNeed),
    leftTimeInt: allTimeNeed
  }
}
