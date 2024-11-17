import { memo } from 'react'
import ResolutionForm from './resolution-form'
import {
  Modal
} from 'antd'
import uid from '../../common/uid'

export default function Resolutions (props) {
  function remove (id) {
    const { resolutions } = props
    const index = resolutions.findIndex(d => d.id === id)
    if (index < 0) {
      return
    }
    resolutions.splice(index, 1)
    window.store.setState('resolutions', resolutions)
  }

  function submit (data) {
    const { resolutions } = props
    resolutions.push({
      ...data,
      id: uid()
    })
    window.store.setState('resolutions', resolutions)
  }

  const {
    resolutions
  } = props
  const {
    openResolutionEdit,
    toggleResolutionEdit
  } = window.store
  if (!openResolutionEdit) {
    return null
  }
  const modalProps = {
    footer: null,
    visible: true,
    onCancel: () => toggleResolutionEdit()
  }
  const resList = {
    list: resolutions,
    initialValues: {
      width: 1600,
      height: 900
    },
    remove,
    submit
  }
  return (
    <Modal
      {...modalProps}
    >
      <ResolutionForm
        {...resList}
      />
    </Modal>
  )
}
