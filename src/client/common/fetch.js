// the final fetch wrapper
import _ from 'lodash'
import {notification} from 'antd'

const jsonHeader = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

function parseResponse(response) {
  let contentType = response.headers.get('content-type') || ''
  let isJsonResult = contentType.toLowerCase().includes('application/json')
  return isJsonResult ? response.json() : response.text()
}

export async function handleErr(res) {
  console.log(res)
  let text = res.message
  try {
    text = _.isFunction(res.text)
      ? await res.text()
      : res.message
  } catch(e) {
    console.log('res.text fails')
  }
  console.log(text, 'err info')
  notification.error({
    message: 'error',
    description: text,
    duration: 55
  })
}

export default class Fetch {

  static get(url, data, options) {
    return Fetch.connect(url, 'get', null, options)
  }

  static post(url, data, options) {
    return Fetch.connect(url, 'post', data, options)
  }

  static connect(url, method, data, options = {}) {
    let body = {
      method,
      body: data
        ? JSON.stringify(data)
        : undefined,
      headers: jsonHeader,
      timeout: 180000,
      ...options
    }
    return fetch(url, body)
      .then(res => {
        if (res.status > 304) {
          throw res
        }
        return res
      })
      .then(options.handleResponse || parseResponse, options.handleErr || handleErr)
  }
}

