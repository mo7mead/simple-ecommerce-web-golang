import {
  Box, AppBar, Toolbar, Typography, Avatar, IconButton, Tooltip, useTheme,
} from '@mui/material'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import { cloneElement, useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const FULL = 252
const MINI = 68
// Refined easing: longer travel, slower at the end — feels less mechanical.
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DURATION = 320

interface NavLink {
  to: string
  label: string
  icon: ReactElement<{ sx?: { fontSize?: number } }>
}
interface NavGroup {
  group: string
  links: NavLink[]
}

const items: NavGroup[] = [
  { group: 'Overview', links: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: <DashboardOutlinedIcon /> },
  ]},
  { group: 'Content', links: [
    { to: '/admin/slides', label: 'Home slides', icon: <CollectionsOutlinedIcon /> },
    { to: '/admin/flash-sales', label: 'Flash sales', icon: <BoltOutlinedIcon /> },
    { to: '/admin/brands', label: 'Brands', icon: <StorefrontOutlinedIcon /> },
    { to: '/admin/categories', label: 'Categories', icon: <CategoryOutlinedIcon /> },
    { to: '/admin/branding', label: 'Branding', icon: <BrushOutlinedIcon /> },
  ]},
  { group: 'Manage', links: [
    { to: '/admin/products', label: 'Product approvals', icon: <Inventory2OutlinedIcon /> },
    { to: '/admin/users', label: 'Users', icon: <PeopleAltOutlinedIcon /> },
    { to: '/admin/sessions', label: 'Sessions', icon: <HistoryOutlinedIcon /> },
  ]},
  { group: 'System', links: [
    { to: '/admin/settings', label: 'Settings', icon: <TuneOutlinedIcon /> },
    { to: '/', label: 'Back to site', icon: <HomeOutlinedIcon /> },
  ]},
]

const sizedIcon = (icon: ReactElement<{ sx?: { fontSize?: number } }>, fontSize = 20) =>
  cloneElement(icon, { sx: { fontSize } })

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('admin-side-collapsed') === '1' } catch { return false }
  })
  const { user, signOut, settings } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const theme = useTheme()
  const width = collapsed ? MINI : FULL
  const initial = (user?.displayName || user?.username || '?')[0].toUpperCase()
  const brandInitial = (settings?.siteName || 'S')[0].toUpperCase()

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem('admin-side-collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  // Cmd/Ctrl + B toggles the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const shortcut = isMac ? '⌘ B' : 'Ctrl B'

  const crumb = loc.pathname.replace(/^\/admin\/?/, '') || 'dashboard'
  const crumbLabel = crumb.charAt(0).toUpperCase() + crumb.slice(1).replace(/-/g, ' ')

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside
        className="group/sidebar relative flex flex-col text-slate-300
                   bg-gradient-to-b from-[#0c0e13] via-[#10131b] to-[#0a0c11]
                   shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),0_0_30px_rgba(0,0,0,0.2)]
                   transform-gpu"
        style={{
          width,
          flexShrink: 0,
          transition: `width ${DURATION}ms ${EASE}`,
          willChange: 'width',
        }}
      >
        {/* Floating collapse toggle on the sidebar's right edge */}
        <Tooltip
          title={
            <span className="flex items-center gap-1.5">
              {collapsed ? 'Expand' : 'Collapse'} sidebar
              <kbd className="rounded bg-white/15 px-1 text-[10px] font-semibold">{shortcut}</kbd>
            </span>
          }
          placement="right"
          arrow
          enterDelay={250}
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute top-[26px] z-20 flex h-7 w-7 items-center justify-center rounded-full
                       bg-[#15181f] text-slate-400 ring-1 ring-white/10
                       shadow-[0_4px_12px_-2px_rgba(0,0,0,0.4)]
                       opacity-60
                       hover:bg-gradient-to-br hover:from-indigo-500 hover:to-violet-600 hover:text-white
                       hover:ring-indigo-300/40 hover:opacity-100 hover:scale-110
                       group-hover/sidebar:opacity-100
                       focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            style={{
              right: -14,
              transition: `opacity ${DURATION}ms ${EASE}, background-color 200ms ${EASE},
                           color 200ms ${EASE}, transform 200ms ${EASE},
                           box-shadow 200ms ${EASE}, ring-color 200ms ${EASE}`,
            }}
          >
            <ChevronLeftIcon
              sx={{
                fontSize: 16,
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: `transform ${DURATION}ms ${EASE}`,
              }}
            />
          </button>
        </Tooltip>

        {/* Brand — fixed grid layout so logo stays put while label fades out */}
        <div
          className="grid h-14 items-center gap-3 overflow-hidden border-b border-white/5"
          style={{
            gridTemplateColumns: collapsed ? '36px 0fr' : '36px 1fr',
            justifyContent: collapsed ? 'center' : 'start',
            paddingLeft: collapsed ? 0 : 16,
            paddingRight: collapsed ? 0 : 16,
            transition: `grid-template-columns ${DURATION}ms ${EASE}, padding ${DURATION}ms ${EASE}`,
          }}
        >
          <div className="relative flex h-9 w-9 flex-none items-center justify-center rounded-lg
                          bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md
                          ring-1 ring-white/15 font-bold text-[15px]">
            {settings?.logoPath ? (
              <img src={settings.logoPath} alt="" className="h-full w-full rounded-lg object-cover" />
            ) : brandInitial}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#10131b]" />
          </div>
          <div
            className="min-w-0 overflow-hidden whitespace-nowrap"
            style={{
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
              transition: `opacity 220ms ${EASE} ${collapsed ? '0ms' : '80ms'}, transform 260ms ${EASE}`,
              pointerEvents: collapsed ? 'none' : 'auto',
              visibility: collapsed ? 'hidden' : 'visible',
            }}
          >
            <div className="truncate text-[15px] font-bold leading-tight text-white">
              {settings?.siteName?.split(' ')[0] || 'Smple'}
              <span className="ml-1 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Admin
              </span>
            </div>
            <div className="truncate text-[11px] text-slate-500">Console v1</div>
          </div>
        </div>

        {/* Nav */}
        <nav
          className="admin-nav flex-1 overflow-y-auto px-2 pb-4 pt-3"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)',
          }}
        >
          {items.map((group) => (
            <div key={group.group} className="mb-3">
              <div
                className="flex items-center gap-1.5 overflow-hidden px-3 text-[10px] font-bold uppercase
                           tracking-[0.12em] text-slate-500/90"
                style={{
                  maxHeight: collapsed ? 0 : 28,
                  opacity: collapsed ? 0 : 1,
                  transition: `max-height 200ms ${EASE}, opacity 200ms ${EASE}, padding 200ms ${EASE}`,
                  paddingTop: collapsed ? 0 : 10,
                  paddingBottom: collapsed ? 0 : 6,
                }}
              >
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>{group.group}</span>
                <span className="ml-1 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </div>
              <ul className="list-none m-0 p-0 space-y-0.5">
                {group.links.map((l) => {
                  const active = loc.pathname === l.to
                  const inner = (
                    <RouterLink
                      to={l.to}
                      className={`group/item relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium
                                  no-underline overflow-hidden outline-none
                                  focus-visible:ring-2 focus-visible:ring-indigo-400/60
                                  ${collapsed ? 'mx-auto h-9 w-9 justify-center' : 'h-9 px-2'}
                                  ${active
                                    ? 'bg-gradient-to-r from-indigo-500/[0.12] via-white/[0.05] to-transparent text-white ring-1 ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                                    : 'text-slate-300 hover:bg-white/[0.045] hover:text-white active:scale-[0.98]'
                                  }`}
                      style={{ transition: `background-color 180ms ${EASE}, color 180ms ${EASE}, transform 100ms ${EASE}` }}
                    >
                      {/* Active rail */}
                      <span
                        className="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r
                                   bg-gradient-to-b from-indigo-400 via-violet-500 to-fuchsia-500
                                   shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                        style={{
                          height: active ? 18 : 0,
                          opacity: active ? 1 : 0,
                          transition: `height 240ms ${EASE}, opacity 240ms ${EASE}`,
                        }}
                      />
                      <span
                        className={`flex h-7 w-7 flex-none items-center justify-center rounded-md transition-all duration-200
                                   ${active
                                     ? 'bg-gradient-to-br from-indigo-500/30 to-violet-500/15 text-indigo-100 ring-1 ring-indigo-400/20'
                                     : 'bg-transparent text-slate-400 group-hover/item:bg-white/5 group-hover/item:text-white'
                                   }`}
                      >
                        {sizedIcon(l.icon, 17)}
                      </span>
                      <span
                        className="truncate"
                        style={{
                          opacity: collapsed ? 0 : 1,
                          transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                          transition: `opacity 220ms ${EASE} ${collapsed ? '0ms' : '80ms'},
                                       transform 260ms ${EASE}`,
                          pointerEvents: collapsed ? 'none' : 'auto',
                          visibility: collapsed ? 'hidden' : 'visible',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {l.label}
                      </span>
                    </RouterLink>
                  )
                  return (
                    <li key={l.to}>
                      {collapsed
                        ? <Tooltip title={l.label} placement="right" arrow enterDelay={200}>{inner}</Tooltip>
                        : inner
                      }
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Profile footer */}
        <div className="border-t border-white/5 p-2">
          <RouterLink
            to="/profile"
            className={`group/footer flex items-center gap-3 rounded-xl p-2 no-underline transition
                       hover:bg-white/[0.04] ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="relative flex-none">
              <Avatar
                src={user?.avatarPath || undefined}
                sx={{
                  width: 32, height: 32,
                  bgcolor: theme.palette.primary.main,
                  fontSize: 13, fontWeight: 700,
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.05)',
                }}
              >
                {initial}
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#10131b]" />
            </div>
            <div
              className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
              style={{
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                transition: `opacity 220ms ${EASE} ${collapsed ? '0ms' : '80ms'}, transform 260ms ${EASE}`,
                pointerEvents: collapsed ? 'none' : 'auto',
                visibility: collapsed ? 'hidden' : 'visible',
              }}
            >
              <div className="truncate text-[13px] font-semibold text-white">
                {user?.displayName || user?.username}
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-md bg-indigo-500/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-indigo-300 ring-1 ring-indigo-400/10">
                  {user?.role}
                </span>
              </div>
            </div>
            {!collapsed && (
              <button
                type="button"
                onClick={async (e) => { e.preventDefault(); await signOut(); nav('/login') }}
                aria-label="Sign out"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-400 opacity-0
                           transition-all group-hover/footer:opacity-100 hover:bg-rose-500/15 hover:text-rose-300"
              >
                <LogoutOutlinedIcon sx={{ fontSize: 16 }} />
              </button>
            )}
          </RouterLink>
        </div>

        {/* Custom scrollbar for the nav area */}
        <style>{`
          .admin-nav::-webkit-scrollbar { width: 6px }
          .admin-nav::-webkit-scrollbar-track { background: transparent }
          .admin-nav::-webkit-scrollbar-thumb {
            background-color: rgba(255,255,255,0.08); border-radius: 3px;
          }
          .admin-nav::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.16) }
          .admin-nav { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent }
        `}</style>
      </aside>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <AppBar position="static" elevation={0} sx={{
          bgcolor: '#fff', color: 'text.primary', borderBottom: 1, borderColor: 'divider',
        }}>
          <Toolbar sx={{ gap: 1 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
              Admin / <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{crumbLabel}</Box>
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Notifications">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
            <Avatar src={settings?.logoPath || undefined}
              sx={{ width: 28, height: 28, bgcolor: theme.palette.primary.main, fontSize: 12, mr: 0.5 }}>
              {brandInitial}
            </Avatar>
            <IconButton size="small" onClick={async () => { await signOut(); nav('/login') }} title="Sign out">
              <Avatar src={user?.avatarPath || undefined}
                sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main, fontSize: 14 }}>
                {initial}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
