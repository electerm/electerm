import React from 'react'
import {
  InfoCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
  CloseCircleFilled
} from '@ant-design/icons'

export const messageIcons = {
  info: <InfoCircleFilled className='msg-icon info' />,
  success: <CheckCircleFilled className='msg-icon success' />,
  warning: <ExclamationCircleFilled className='msg-icon warning' />,
  error: <CloseCircleFilled className='msg-icon error' />
}

export const getMessageIcon = (type) => messageIcons[type] || messageIcons.info
