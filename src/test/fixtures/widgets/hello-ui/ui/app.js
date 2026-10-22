/* eslint-env browser */
/* global electerm */

const out = document.getElementById('out')
const nameInput = document.getElementById('name')

function show (value) {
  out.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

document.getElementById('greet').addEventListener('click', async () => {
  try {
    show(await electerm.call('greet', nameInput.value))
  } catch (err) {
    show('error: ' + err.message)
  }
})

document.getElementById('upper').addEventListener('click', async () => {
  try {
    show(await electerm.call('upper', nameInput.value))
  } catch (err) {
    show('error: ' + err.message)
  }
})

document.getElementById('copy').addEventListener('click', async () => {
  await electerm.copy(out.textContent)
  show('copied')
})

// init data (theme variables, widget version) arrives from the host
electerm.ready.then(init => {
  document.title = init.name + ' ' + init.version
  show('bridge ready: ' + init.id + ' / ' + init.colorScheme)
})
