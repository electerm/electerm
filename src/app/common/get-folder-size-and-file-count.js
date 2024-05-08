exports.getSizeCount = function (str) {
  const [s1, s2] = str.split('\n').map(d => d.trim())
  const arr = s1.split(/\s+/)
  const d1 = arr[0]
  let size = parseFloat(d1)
  const unit = d1.slice(-1)
  if (unit === 'M') {
    size = size / 1024
  } else if (unit === 'K') {
    size = size / 1024 / 1024
  }
  const count = parseInt(s2, 10)
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
      count = parseInt(s2, 10)
      all = all + 1
      if (all > 1) {
        break
      }
    } else if (s1 === 'Sum') {
      all = all + 1
      size = parseInt(s2, 10) / 1024
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
