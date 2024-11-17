import { auto } from 'manate/react'
import TabsSubMenuChild from './sub-tab-menu'

export default auto(function TabsSubMenu (props) {
  const { store } = props
  return (
    <div className='sub-context-menu'>
      {
        store.getTabs().map(item => {
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
})
