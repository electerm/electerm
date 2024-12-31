/**
 * bookmark
 */

import uid from '../common/uid'

export default Store => {
  Store.prototype.handleGetSerials = async function () {
    const { store } = window
    store.loaddingSerials = true
    const res = await window.pre.runGlobalAsync('listSerialPorts')
      .catch(store.onError)
    if (res) {
      store.serials = res
    }
    store.loaddingSerials = false
  }
  Store.prototype.setBookmarks = function (items) {
    return window.store.setItems('bookmarks', items)
  }

  Store.prototype.addSshConfigs = function (items) {
    const { store } = window

    const bookmarksToAdd = items.map(t => {
      return {
        term: 'xterm-256color',
        id: uid(),
        type: 'local',
        title: 'ssh config: ' + t.title,
        color: '#0088cc',
        runScripts: [
          {
            script: `ssh ${t.title}`,
            delay: 500
          }
        ]
      }
    }).filter(d => {
      return !store.bookmarks.find(t => t.title === d.title)
    })
    const ids = bookmarksToAdd.map(d => d.id)
    let sshConfigGroup = store.bookmarkGroups.find(d => d.id === 'sshConfig')
    if (!sshConfigGroup) {
      sshConfigGroup = {
        id: 'sshConfig',
        title: 'ssh configs',
        bookmarkIds: ids
      }
      store.addBookmarkGroup(sshConfigGroup)
    } else {
      store.editItem('sshConfig', {
        bookmarkIds: [
          ...ids,
          ...(sshConfigGroup.bookmarkIds || [])
        ]
      })
    }
    return store.addItems(bookmarksToAdd, 'bookmarks')
  }
}
