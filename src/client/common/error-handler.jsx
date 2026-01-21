/**
 * common error handler
 */

import { notification } from '../components/common/notification'

export default (e) => {
  const { message = 'error', stack } = e
  console.error(e)
  const description = (
    <div
      className='common-err-desc'
      title={stack}
    >
      {stack}
    </div>
  )
  notification.error({
    message,
    description,
    duration: 55
  })
}
