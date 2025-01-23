/**
 * create bookmark group tree data
 */

export default (bookmarkGroups = [], disabledId = '', returnMap = false) => {
  const btree = new Map(bookmarkGroups.map(d => [d.id, d]))
  function buildSubCats (id) {
    const x = btree.get(id)
    if (!x) {
      return ''
    }
    const y = {
      key: x.id,
      value: x.id,
      title: x.title
    }
    y.children = (x.bookmarkGroupIds || []).map(buildSubCats).filter(d => d)
    if (!y.children.length) {
      delete y.children
    }
    return y
  }
  const level1 = bookmarkGroups.filter(d => d.level !== 2)
    .map(d => {
      const r = {
        title: d.title,
        value: d.id,
        key: d.id,
        disabled: d.id === disabledId,
        children: (d.bookmarkGroupIds || []).map(buildSubCats).filter(d => d)
      }
      return r
    }).filter(d => d)
  if (returnMap) {
    return [level1, btree]
  }
  return level1
}
