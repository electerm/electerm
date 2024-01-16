import {
  logoPath1,
  logoPath2,
  logoPath3,
  packInfo
} from '../../common/constants'
import { Tag } from 'antd'
import './logo.styl'

export default function LogoElem () {
  return (
    <h1 className='mg3y font50'>
      <span className='iblock pd3 morph-shape mg1l mg1r'>
        <img src={logoPath2} className='iblock mwm-100 mg1l mg1r logo-filter logo-img' />
      </span>
      <img src={logoPath3} className='hide logo-img' />
      <sup>
        <img src={logoPath1} className='iblock mwm-100 mg1r logo-img-small' />
      </sup>
      <Tag color='#08c'>{packInfo.version}</Tag>
    </h1>
  )
}
