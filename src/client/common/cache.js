// cache class that can set(key, value), get(key), init with limit, so we only
// keep limit items in cache
// we persist cache to local storage, so we can keep cache after restart

class MapCache {
  constructor (limit, key) {
    this.limit = limit
    this.key = key
    this.cache = new Map()
    this.load()
  }

  load () {
    const data = window.localStorage.getItem(this.key)
    if (data) {
      const arr = JSON.parse(data)
      for (const item of arr) {
        this.cache.set(item.key, item.value)
      }
    }
  }

  save () {
    const arr = []
    for (const [key, value] of this.cache) {
      arr.push({
        key,
        value
      })
    }
    window.localStorage.setItem(this.key, JSON.stringify(arr))
  }

  set (key, value) {
    this.cache.set(key, value)
    if (this.cache.size > this.limit) {
      // Delete oldest 20 items when cache exceeds limit
      const values = Array.from(this.cache.values())
      for (let i = 0; i < 20 && i < values.length; i++) {
        this.cache.delete(values[i])
      }
    }
    this.save()
  }

  get (key) {
    return this.cache.get(key)
  }

  clear () {
    this.cache.clear()
    this.save()
  }
}

export const aiSuggestionsCache = new MapCache(100, 'ai-cmd-suggestion-cache')
