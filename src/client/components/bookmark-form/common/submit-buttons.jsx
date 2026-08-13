/**
 * Common submit buttons component for bookmark forms
 * Provides save, connect, and test functionality
 */
import React from 'react'
import { Button, Form } from 'antd'
import { CaretRightOutlined } from '@ant-design/icons'
import { tailFormItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function SubmitButtons ({
  onSave,
  onSaveAndCreateNew,
  onConnect,
  onTestConnection,
  onSaveAndConnect
}) {
  return (
    <FormItem {...tailFormItemLayout} className='bookmark-form-actions'>
      <div className='bookmark-form-actions-row'>
        {/* Save cluster, left. Only one filled button: submitting the form is
            the action you want almost every time. */}
        <Button type='primary' htmlType='submit'>
          {e('saveAndConnect')}
        </Button>
        <Button onClick={onSaveAndCreateNew}>
          {e('saveAndCreateNew')}
        </Button>
        <Button onClick={onSave}>
          {e('save')}
        </Button>
        {/* Connect cluster, pushed right. Test connection is a diagnostic, so
            it carries the least weight of anything here. */}
        <Button
          type='text'
          className='bookmark-form-actions-gap'
          onClick={onTestConnection}
        >
          {e('testConnection')}
        </Button>
        {/* Outlined, not filled: it stays in the primary colour family so it
            reads as an exit, but only one button on the row is allowed to be
            solid or the eye cannot tell which action is the default. */}
        <Button
          color='primary'
          variant='outlined'
          icon={<CaretRightOutlined />}
          onClick={onConnect}
        >
          {e('connect')}
        </Button>
      </div>
    </FormItem>
  )
}
