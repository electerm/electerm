/**
 * Create a quick command from outside the settings panel (e.g. from the
 * command history action menu), reusing the very same form the settings panel
 * uses — no fork of the form, so fields/validation stay in sync.
 *
 * The form is heavy (form, shortcuts editor, templates), and it otherwise only
 * lives inside the lazily loaded quick commands setting tab, so lazy load it
 * here as well.
 */

import { lazy, Suspense } from 'react'
import {
  Modal,
  Spin
} from 'antd'
import LazyBoundary from '../common/lazy-boundary'
import generate from '../../common/uid'

const QuickCommandForm = lazy(() => import('./quick-commands-form'))

const e = window.translate

export default function QuickCommandCreateModal (props) {
  const { store, command, onClose } = props
  const formData = {
    id: '',
    name: e('newQuickCommand'),
    commands: [{
      command,
      id: generate(),
      delay: 100
    }]
  }
  return (
    <Modal
      open
      title={e('addQuickCommands')}
      onCancel={onClose}
      destroyOnHidden
      footer={null}
      width={560}
    >
      <LazyBoundary>
        <Suspense
          fallback={(
            <div className='pd3 aligncenter'>
              <Spin />
            </div>
          )}
        >
          <QuickCommandForm
            store={store}
            formData={formData}
            onSaved={onClose}
          />
        </Suspense>
      </LazyBoundary>
    </Modal>
  )
}
