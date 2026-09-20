import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { QuickNoteApp } from './QuickNoteApp'
import { bootstrapTheme } from './theme'
import './global.css'

const hash = window.location.hash.replace(/^#\/?/, '')
const isQuick = hash === 'quick'

// 尽早同步应用主题（避免首屏闪默认主题）
bootstrapTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isQuick ? <QuickNoteApp /> : <App />}</React.StrictMode>
)
