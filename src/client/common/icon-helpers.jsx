import React from 'react'
import { Info, CheckCircle, AlertCircle, XCircle } from 'lucide-react'

export const messageIcons = {
  info: <Info className='msg-icon info' />,
  success: <CheckCircle className='msg-icon success' />,
  warning: <AlertCircle className='msg-icon warning' />,
  error: <XCircle className='msg-icon error' />
}

export const getMessageIcon = (type) => messageIcons[type] || messageIcons.info
