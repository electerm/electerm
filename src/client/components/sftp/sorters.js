/**
 * file list sorters
 */

export default (prop, order = 'DESC') => {
  return (a, b) => {
    let ad = a.isDirectory
    let bd = b.isDirectory
    let aa, bb
    if (ad !== bd) {
      aa = a.isDirectory ? 0 : 1
      bb = b.isDirectory ? 0 : 1
      return aa - bb
    } else {
      aa = a[prop]
      bb = b[prop]
    }
    if (order === 'DESC') {
      return bb > aa ? 1 : -1
    }
    return bb > aa ? -1 : 1
  }
}

export const sortBys = [
  'modifyTime',
  'size'
]

export const ordersMap = {
  DESC: 'DESC',
  ASC: 'ASC'
}

