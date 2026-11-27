/**
 * highlight keywords in text
 * accepts a single keyword string or an array of keywords
 */

import './highlight.styl'
import { getHighlightRanges } from '../../common/search-keywords.js'

export default (text, keyword) => {
  if (!keyword || !text) return text
  const title = String(text)
  const ranges = getHighlightRanges(title, Array.isArray(keyword) ? keyword : [keyword])
  if (!ranges.length) return text
  const parts = []
  let offset = 0
  for (const { start, end } of ranges) {
    parts.push(title.slice(offset, start))
    parts.push(<span className='highlight' key={start}>{title.slice(start, end)}</span>)
    offset = end
  }
  parts.push(title.slice(offset))
  return parts
}
