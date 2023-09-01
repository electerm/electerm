/**
 * highlight keyword in text
 * single keyword only
 */

import './highlight.styl'

export default (text, keyword) => {
  if (!keyword || !text.includes(keyword)) {
    return text
  }
  const arr = text.split(keyword)
  const len = arr.length
  return arr.reduce((prev, t, i) => {
    return [
      ...prev,
      t,
      i === len - 1
        ? null
        : <span className='highlight'>{keyword}</span>
    ]
  }, [])
}
