/**
 * Profile selector component for config-driven forms
 * Allows selecting from available profiles with filtering
 */
import React from 'react'
import { Form, Select } from 'antd'
import { formItemLayout } from '../../../common/form-layout'
import { authTypeMap } from '../../../common/constants'

const FormItem = Form.Item
const e = window.translate

export default function ProfileItem ({ store, form, profileFilter = (d) => d }) {
  const handleChange = (value) => {
    // applyProfile only resolves credentials when authType is 'profiles',
    // selecting a profile here means bookmark auth should come from it
    form?.setFieldsValue({
      authType: value ? authTypeMap.profiles : authTypeMap.password
    })
  }

  const opts = {
    options: store.profiles
      .filter(profileFilter)
      .map(d => ({
        label: d.name,
        value: d.id
      })),
    placeholder: e('profiles'),
    allowClear: true,
    onChange: handleChange
  }

  return (
    <FormItem
      {...formItemLayout}
      label={e('profiles')}
      name='profile'
      hasFeedback
    >
      <Select {...opts} />
    </FormItem>
  )
}
