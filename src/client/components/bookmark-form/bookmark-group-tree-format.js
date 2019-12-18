/**
 * create bookmark group tree data
 */

export default (bookmarkGroups = []) => {
  const dict = bookmarkGroups
    .reduce((prev, k) => {
      return {
        ...prev,
        [k.id]: k
      }
    }, {})
  return bookmarkGroups
    .filter(d => d.level !== 2)
    .map(j => {
      const r = {
        title: j.title,
        value: j.id,
        key: j.id
      }
      if (j.bookmarkGroupIds && j.bookmarkGroupIds.length) {
        r.children = j.bookmarkGroupIds.map(k => {
          const o = dict[k]
          return o
            ? {
              title: o.title,
              value: o.id,
              key: o.id
            }
            : null
        })
        r.children = r.children.filter(d => d)
        if (!r.children.length) {
          delete r.children
        }
      }
      return r
    })
}
