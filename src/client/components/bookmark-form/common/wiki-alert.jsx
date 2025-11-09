import Link from '../../common/external-link'

export default function WikiAlert ({ wikiUrl }) {
  return (
    <div className='alignright bold pd2'>
      <Link to={wikiUrl}>WIKI: {wikiUrl}</Link>
    </div>
  )
}
