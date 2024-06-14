/**
 * create bookmark group tree data
 */

export default (bookmarkGroups = []) => {
  const btree = bookmarkGroups
    .reduce((prev, k) => {
      return {
        ...prev,
        [k.id]: k
      }
    }, {})
  function buildSubCats (id) {
    const x = btree[id]
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
        children: (d.bookmarkGroupIds || []).map(buildSubCats).filter(d => d)
      }
      return r
    }).filter(d => d)
  return level1
}
