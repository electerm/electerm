import React from 'react'
import {getLatestReleaseInfo} from '../../common/update-check'

export default class FileMode extends React.Component {

  componentDidMount() {
    getLatestReleaseInfo()
  }

  render() {
    return null
  }

}
