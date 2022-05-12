
export function setItem (id, str) {
  try {
    window.localStorage.setItem(id, str)
  } catch (e) {
    console.log(e)
    console.log('maybe local storage full, lets reset')
    window.localStorage.clear()
    window.localStorage.setItem(id, str)
  }
}

export function getItem (id) {
  return window.localStorage.getItem(id) || ''
}

export function getItemJSON (id, defaultValue) {
  const str = window.localStorage.getItem(id) || ''
  return str ? JSON.parse(str) : defaultValue
}

export function setItemJSON (id, obj) {
  const str = JSON.stringify(obj)
  return setItem(id, str)
}
