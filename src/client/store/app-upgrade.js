/**
 * app upgrade
 */

export default store => {
  store.onCheckUpdate = (noSkipVersion = false) => {
    if (store.onCheckUpdating) {
      return
    }
    const prefix = noSkipVersion ? 'noSkipVersion' : ''
    store.shouldCheckUpdate = prefix + new Date()
  }
}
