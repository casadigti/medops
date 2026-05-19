import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import './index.css'

// NOTE: React.StrictMode was removed because it causes useEffect to run twice
// in development, which created concurrent getSession() calls that deadlocked
// the Supabase JS client's internal request queue.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>
)
