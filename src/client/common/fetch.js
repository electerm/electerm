// the final fetch
import _ from 'lodash'
import parseJson from './parse-json-safe'

const updateLoadingState = (index) => {
  let id = `loading-bar${index}`
  let dom = document.getElementById(id)

  if (dom) {
    return dom.parentNode && dom.parentNode.removeChild(dom)
  }

  let html = document.createElement('div')
  html.className = 'loading-bar loading'
  html.id = id
  document.body.appendChild(html)
  //`<div id="${id}" className="loading-bar"></div>`
}

//正在取数据计数
window.__fetchCount = 0

let fetchIndex = 0

const jsonHeader = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

function parseResponse(response) {
  let contentType = response.headers.get('content-type') || ''
  let isJsonResult = contentType.toLowerCase().indexOf('application/json') !== -1

  return isJsonResult ? response.json() : response.text()
}

export function serialized(data) {
  return data
    ? `?q=${JSON.stringify(data)}`
    : ''
}

export async function handleErr(res) {
  console.log(res)
  let text = _.isFunction(res.text)
    ? await res.text()
    : _.isPlainObject(res) ? JSON.stringify(res) : res

  console.log(text, 'err info')
  try {
    text = parseJson(text).error || text
  } catch (e) {
    console.log('not a json error')
  }

}

export default class Fetch {

  static get(url, data, options) {
    return Fetch.connect(url + serialized(data), 'get', null, options)
  }

  static post(url, data, options) {
    return Fetch.connect(url, 'post', data, options)
  }

  static delete(url, data, options) {
    return Fetch.connect(url, 'delete', data, options)
  }

  static put(url, data, options) {
    return Fetch.connect(url, 'put', data, options)
  }

  static patch(url, data, options) {
    return Fetch.connect(url, 'patch', data, options)
  }

  //todo jsonp if needed
  static connect(url, method, data, options = {}) {
    let body = {
      method,
      body: data
        ? JSON.stringify({
          q: JSON.stringify(data)
        })
        : undefined,
      headers: jsonHeader,
      timeout: 180000,
      ...options
    }
    let index = fetchIndex + 0
    fetchIndex ++
    if (fetchIndex > 1<<29) {
      fetchIndex = 0
    }
    window.__fetchCount ++
    updateLoadingState(index)
    return fetch(url, body)
      .then(res => {
        window.__fetchCount --
        if (res.status > 304) {
          throw res
        }
        return res
      })
      .then(options.handleResponse || parseResponse, options.handleErr || handleErr)
  }
}

