import { Component } from '../common/react-subx'
import ResolutionForm from './resolution-form'
import {
  Modal
} from 'antd'
import uid from '../../common/uid'

export default class Resolutions extends Component {
  remove = id => {
    const { store } = this.props
    const { resolutions } = store
    const index = resolutions.findIndex(d => d.id === id)
    if (index < 0) {
      return
    }
    resolutions.splice(index, 1)
    store.setState('resolutions', resolutions)
  }

  submit = (data) => {
    const { store } = this.props
    const { resolutions } = store
    resolutions.push({
      ...data,
      id: uid()
    })
    store.setState('resolutions', resolutions)
  }

  render () {
    const {
      openResolutionEdit,
      toggleResolutionEdit,
      resolutions
    } = this.props.store
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
      remove: this.remove,
      submit: this.submit
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
}
