import { Tabs } from 'antd'
import ProfileFormSsh from './profile-form-ssh'
import ProfileFormRdp from './profile-form-rdp'
import ProfileFormVnc from './profile-form-vnc'
import ProfileFormTelnet from './profile-form-telnet'

const { TabPane } = Tabs

export default function ProfileTabs (props) {
  const { activeTab, onChangeTab, form, store } = props
  const tabsProps = {
    activeKey: activeTab,
    onChange: onChangeTab
  }
  return (
    <Tabs {...tabsProps}>
      <TabPane tab='ssh' key='ssh' forceRender>
        <ProfileFormSsh form={form} store={store} />
      </TabPane>
      <TabPane tab='telnet' key='telnet' forceRender>
        <ProfileFormTelnet form={form} store={store} />
      </TabPane>
      <TabPane tab='vnc' key='vnc' forceRender>
        <ProfileFormVnc />
      </TabPane>
      <TabPane tab='rdp' key='rdp' forceRender>
        <ProfileFormRdp />
      </TabPane>
    </Tabs>

  )
}
