/**
 * load data from db
 */

import { dbNames, update, getData, fetchInitData, insert, remove } from '../common/db'
import initWatch from './watch'

export default (store) => {
  store.batchDbUpdate = async (updates) => {
    for (const u of updates) {
      await update(u.id, u.update, u.db, u.upsert)
    }
  }
  store.batchDbAdd = async (adds) => {
    for (const u of adds) {
      insert(u.db, u.obj)
    }
  }
  store.batchDbDel = async (dels) => {
    for (const u of dels) {
      await remove(u.db, u.id)
    }
  }
  store.initData = async () => {
    await store.checkForDbUpgrade()
    const ext = {}
    for (const name of dbNames) {
      ext[name] = await fetchInitData(name)
    }
    ext.openedCategoryIds = await getData('openedCategoryIds') || ext.bookmarkGroups.map(b => b.id)
    await store.checkLastSession()
    Object.assign(store, ext)

    await store.checkDefaultTheme()
    await store.initShortcuts()
    await store.loadFontList()
    initWatch(store)
  }
}
