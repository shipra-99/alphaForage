import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Landing, Market, Portfolio, Events } from './pages/index.js'
import AppShell from './components/layout/AppShell.jsx'
import Research from './pages/Research.jsx'
import Screener from './pages/Screener.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/app/research" replace />} />
        <Route path="research"  element={<Research />} />
        <Route path="screener"  element={<Screener />} />
        <Route path="market"    element={<Market />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="events"    element={<Events />} />
      </Route>
    </Routes>
  )
}
