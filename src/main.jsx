import React from 'react'
import ReactDOM from 'react-dom/client'
import BoardBrain from '../boardbrain-production.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BoardBrain />
  </React.StrictMode>,
)
