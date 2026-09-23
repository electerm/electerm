/**
 * Bookmark form wrapper for triggers.
 * Works as an antd Form field (value/onChange injected by Form.Item).
 */
import { Form } from 'antd'
import TriggerEditor from './trigger-editor.jsx'

const e = window.translate

export default function TriggersField () {
  return (
    <Form.Item
      name='triggers'
      label={e('triggers')}
    >
      <TriggerEditor />
    </Form.Item>
  )
}
