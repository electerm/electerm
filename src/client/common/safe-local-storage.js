
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
  return window.localStorage.getItem(id)
}
