import { Tabs } from 'antd'
import ProfileFormSsh from './profile-form-ssh'
import ProfileFormRdp from './profile-form-rdp'
import ProfileFormVnc from './profile-form-vnc'
import ProfileFormFtp from './profile-form-ftp'
import ProfileFormTelnet from './profile-form-telnet'

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
    },
    {
      label: 'telnet',
      key: 'telnet',
      forceRender: true,
      children: <ProfileFormTelnet form={form} store={store} />
    },
    {
      label: 'vnc',
      key: 'vnc',
      forceRender: true,
      children: <ProfileFormVnc />
    },
    {
      label: 'rdp',
      key: 'rdp',
      forceRender: true,
      children: <ProfileFormRdp />
    },
    {
      label: 'ftp',
      key: 'ftp',
      forceRender: true,
      children: <ProfileFormFtp />
    }
  ]
  return (
    <Tabs {...tabsProps} items={items} />
  )
}
