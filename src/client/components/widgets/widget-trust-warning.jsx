/**
 * One warning for every way of installing a widget.
 *
 * A widget's main.js is a Node module in the host process. The source-import
 * modal used to promise that nothing runs until the widget is opened, which is
 * not true for an instance widget whose manifest declares autoRun: importing
 * selects it, and the panel starts it. Say that plainly here rather than
 * repeating the sentence in each modal, so the two paths cannot drift apart.
 */
import React from 'react'
import { Alert } from 'antd'

export const WIDGET_NODE_WARNING =
  "A widget's main.js runs inside electerm's main process with full Node permissions — it can read files and run commands. An instance widget that declares autoRun starts automatically after install. Only install widgets whose source you trust."

export default function WidgetTrustWarning ({ className = '' }) {
  return (
    <Alert
      className={className}
      type='warning'
      showIcon
      title={WIDGET_NODE_WARNING}
    />
  )
}
