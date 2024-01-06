exports.getSizeCount = function (str) {
  const [s1, s2] = str.trim().split('\n')
  let size = parseFloat(s1.split(/\s+/)[0])
  const unit = s1.slice(-1)
  if (unit === 'G') {
    size = (size * 1024).toFixed(1)
  } else if (unit === 'K') {
    size = (size / 1024).toFixed(1)
  }
  const count = parseInt(s2)
  return {
    count,
    size
  }
}

exports.getSizeCountWin = function (str) {
  const arr = str.trim().split('\n')
  let count = 0
  let size = 0
  let all = 0
  for (const s of arr) {
    const [s1, s2] = s.trim().split(/\s+/)
    if (s1 === 'Count') {
      count = parseInt(s2)
      all = all + 1
      if (all > 1) {
        break
      }
    } else if (s1 === 'Sum') {
      all = all + 1
      size = (parseInt(s2) / 1024).toFixed(1)
      if (all > 1) {
        break
      }
    }
  }
  return {
    count,
    size
  }
}
