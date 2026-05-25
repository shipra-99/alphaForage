import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  MessageSquare, SlidersHorizontal, BarChart2,
  Briefcase, Calendar, Home, Zap,
} from 'lucide-react'
import styles from './AppShell.module.css'

const NAV = [
  { to: '/app/research',  icon: MessageSquare,     label: 'Research' },
  { to: '/app/screener',  icon: SlidersHorizontal, label: 'Screener' },
  { to: '/app/market',    icon: BarChart2,          label: 'Market' },
  { to: '/app/portfolio', icon: Briefcase,          label: 'Portfolio' },
  { to: '/app/events',    icon: Calendar,           label: 'Events' },
]

export default function AppShell() {
  const navigate = useNavigate()
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo} onClick={() => navigate('/')}>
          <div className={styles.logoMark}>α</div>
          <div>
            <div className={styles.logoText}>AlphaForage</div>
            <div className={styles.logoSub}>AI INTELLIGENCE</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>Research</div>
          {NAV.slice(0, 3).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
          <div className={styles.navSection}>Portfolio</div>
          {NAV.slice(3).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.statusRow}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>API on :8000</span>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
