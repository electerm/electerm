import TabsSubMenuChild from './sub-tab-menu'

export default function TabsSubMenu (props) {
  return (
    <div className='sub-context-menu'>
      {
        props.tabs.map(item => {
          return (
            <TabsSubMenuChild
              key={item.id}
              item={item}
            />
          )
        })
      }
    </div>
  )
}
