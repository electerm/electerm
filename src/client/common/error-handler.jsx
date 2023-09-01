/**
 * common error handler
 */

import { notification } from 'antd'

export default (e) => {
  const { message = 'error', stack } = e
  log.error(e)
  const msg = (
    <div className='mw240 elli wordbreak' title={message}>
      {message}
    </div>
  )
  const description = (
    <div
      className='mw300 elli common-err-desc wordbreak'
    >
      {stack}
    </div>
  )
  notification.error({
    message: msg,
    description,
    duration: 55
  })
}
