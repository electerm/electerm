/**
 * Common submit buttons component for bookmark forms
 * Provides save, connect, and test functionality
 */
import React from 'react'
import { Button, Form } from 'antd'
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
    <FormItem {...tailFormItemLayout}>
      <p>
        <Button type='primary' htmlType='submit' className='mg1r mg1b'>
          {e('saveAndConnect')}
        </Button>
        <Button type='primary' className='mg1r mg1b' onClick={onSaveAndCreateNew}>
          {e('saveAndCreateNew')}
        </Button>
        <Button type='dashed' className='mg1r mg1b' onClick={onSave}>
          {e('save')}
        </Button>
      </p>
      <p>
        <Button type='dashed' onClick={onConnect} className='mg1r mg1b'>
          {e('connect')}
        </Button>
        <Button type='dashed' onClick={onTestConnection} className='mg1r mg1b'>
          {e('testConnection')}
        </Button>
      </p>
    </FormItem>
  )
}
