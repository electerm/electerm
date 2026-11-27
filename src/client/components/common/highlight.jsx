/**
 * highlight keywords in text
 * accepts a single keyword string or an array of keywords
 */

import './highlight.styl'

const escapeRegExp = str => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default (text, keyword) => {
  const keywords = (Array.isArray(keyword) ? keyword : [keyword])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (!keywords.length || !text) {
    return text
  }
  const reg = new RegExp(
    `(${keywords.map(escapeRegExp).join('|')})`,
    'gi'
  )
  const arr = String(text).split(reg)
  if (arr.length === 1) {
    return text
  }
  return arr.map((part, i) => {
    return i % 2
      ? <span className='highlight' key={i}>{part}</span>
      : part
  })
}
