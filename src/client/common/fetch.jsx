// the final fetch wrapper
import { isString, isFunction } from 'lodash-es'
import { notification } from '../components/common/notification'

function jsonHeader () {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    token: window.store?.config.tokenElecterm
  }
}

function parseResponse (response) {
  const contentType = response.headers.get('content-type') || ''
  const isJsonResult = contentType.toLowerCase().includes('application/json')
  return isJsonResult ? response.json() : response.text()
}

export async function handleErr (res) {
  console.debug(res)
  let text = res.message || res.statusText
  if (!isString(text)) {
    try {
      text = isFunction(res.text)
        ? await res.text()
        : isFunction(res.json) ? await res.json() : ''
    } catch (e) {
      console.error('fetch response parse fails', e)
    }
  }
  console.debug(text, 'fetch err info')
  notification.error({
    message: 'http request error',
    description: (
      <div className='common-err'>
        {text}
      </div>
    ),
    duration: 55
  })
}

export default class Fetch {
  static get (url, data, options) {
    return Fetch.connect(url, 'get', null, options)
  }

  static post (url, data, options) {
    return Fetch.connect(url, 'post', data, options)
  }

  static connect (url, method, data, options = {}) {
    const body = {
      method,
      body: data
        ? JSON.stringify(data)
        : undefined,
      headers: jsonHeader(),
      timeout: 180000,
      ...options
    }
    return window.fetch(url, body)
      .then(res => {
        if (res.status > 304) {
          throw res
        }
        return res
      })
      .then(options.handleResponse || parseResponse, options.handleErr || handleErr)
  }
}
