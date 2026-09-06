/**
 * Bookmark form wrapper for triggers.
 * Works as an antd Form field (value/onChange injected by Form.Item).
 */
import { Form } from 'antd'
import TriggerEditor from './trigger-editor.jsx'
import { te as e } from './trigger-lang.js'

export default function TriggersField () {
  return (
    <Form.Item
      name='triggers'
      label={e('trigger')}
    >
      <TriggerEditor />
    </Form.Item>
  )
}
