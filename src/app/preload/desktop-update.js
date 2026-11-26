const { ipcRenderer } = require('electron')
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('button').addEventListener('click', () => window.close())
  ipcRenderer.on('desktop-update-progress', (event, { tag, percent, status, title, cancel, language }) => {
    document.title = title
    document.documentElement.lang = language.replace('_', '-')
    document.documentElement.dir = language === 'ar_ar' ? 'rtl' : 'ltr'
    document.querySelector('button').textContent = cancel
    document.querySelector('h1').textContent = 'Electerm ' + tag
    document.getElementById('status').textContent = status
    const bar = document.getElementById('progress')
    if (percent === undefined) bar.removeAttribute('value')
    else bar.value = percent
    document.getElementById('percent').textContent = percent === undefined ? '' : percent + '%'
  })
})
