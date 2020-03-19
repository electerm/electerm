/**
 * load data from db
 */

import { dbNames, dbAction, getArrayData, getData } from '../common/db'

export default (store) => {
  store.batchDbUpdate = async (updates) => {
    for (const u of updates) {
      await dbAction(u.db, 'update', {
        _id: u.id
      }, u.update)
    }
  }
  store.batchDbAdd = async (adds) => {
    for (const u of adds) {
      const { id, ...rest } = u.obj
      await dbAction(u.db, 'insert', {
        _id: id,
        ...rest
      })
    }
  }
  store.batchDbDel = async (dels) => {
    for (const u of dels) {
      await dbAction(u.db, 'remove', {
        _id: u.id
      })
    }
  }
  store.initData = async () => {
    const ext = {}
    for (const name of dbNames) {
      ext[name] = await getArrayData(name)
      ext[name + 'Order'] = await getData(name + ':order') || []
    }
    ext.sessions = await getData('sessions')
    ext.openedCategoryIds = await getData('openedCategoryIds') || ext.bookmarkGroups.map(b => b.id)
    Object.assign(store, ext)
  }
}
