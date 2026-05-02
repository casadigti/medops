import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.jsx'
import './index.css'

// NOTE: React.StrictMode was removed because it causes useEffect to run twice
// in development, which created concurrent getSession() calls that deadlocked
// the Supabase JS client's internal request queue.
// The App.jsx auth flow now uses onAuthStateChange (INITIAL_SESSION) which is
// StrictMode-safe, but removing StrictMode eliminates all risk during debugging.
ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>
)
