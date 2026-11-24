import { Tabs } from 'antd'
import ProfileFormSsh from './profile-form-ssh'

export default function ProfileTabs (props) {
  const { activeTab, onChangeTab, form, store } = props
  const tabsProps = {
    activeKey: activeTab,
    onChange: onChangeTab
  }
  const items = [
    {
      label: 'ssh',
      key: 'ssh',
      forceRender: true,
      children: <ProfileFormSsh form={form} store={store} />
    }
  ]
  return (
    <Tabs {...tabsProps} items={items} />
  )
}
