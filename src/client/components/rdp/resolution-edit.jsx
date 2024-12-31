// import { memo } from 'react'
import ResolutionForm from './resolution-form'
import {
  Modal
} from 'antd'
import uid from '../../common/uid'

export default function Resolutions (props) {
  function remove (id) {
    const { resolutions } = window.store
    const index = resolutions.findIndex(d => d.id === id)
    if (index < 0) {
      return
    }
    resolutions.splice(index, 1)
  }

  function submit (data) {
    const { resolutions } = window.store
    resolutions.push({
      ...data,
      id: uid()
    })
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
    open: true,
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
