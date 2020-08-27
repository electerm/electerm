/**
 * check transfer list if the transfer has conflict to be confirmed by user
 */

import { useEffect, useState } from 'react'
import ConfirModal from './confirm-modal'

export default (props) => {
  const [transfer, setter] = useState(props.confirmList[0] || null)
  useEffect(() => {

  }, props.confirmList)
  if (!transfer) {
    return null
  }
  return (
    <ConfirModal
      {...props}
      transfer={transfer}
    />
  )
}