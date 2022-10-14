import {
  logoPath1,
  logoPath2,
  logoPath3,
  packInfo
} from '../../common/constants'
import { Tag } from 'antd'

export default function LogoElelm () {
  return (
    <h1 className='mg3y font50'>
      <span className='iblock pd3 morph-shape mg1l mg1r'>
        <img src={logoPath2} height={80} className='iblock mwm-100 mg1l mg1r logo-filter' />
      </span>
      <img src={logoPath3} height={80} className='hide' />
      <sup>
        <img src={logoPath1} height={28} className='iblock mwm-100 mg1r' />
      </sup>
      <Tag color='#08c'>{packInfo.version}</Tag>
    </h1>
  )
}
