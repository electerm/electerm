/**
 * Profile selector component for config-driven forms
 * Allows selecting from available profiles with filtering
 */
import React from 'react'
import { Form, Select } from 'antd'
import { verticalFormItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item
const e = window.translate

export default function ProfileItem ({ store, profileFilter = (d) => d }) {
  const opts = {
    options: store.profiles
      .filter(profileFilter)
      .map(d => ({
        label: d.name,
        value: d.id
      })),
    placeholder: e('profiles'),
    allowClear: true
  }

  return (
    <FormItem
      {...verticalFormItemLayout}
      label={e('profiles')}
      name='profile'
      hasFeedback
    >
      <Select {...opts} />
    </FormItem>
  )
}
