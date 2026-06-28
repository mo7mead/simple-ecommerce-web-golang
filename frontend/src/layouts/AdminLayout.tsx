import {
  Box, AppBar, Toolbar, Typography, Avatar, IconButton, Tooltip, useTheme,
  InputBase, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Chip,
  ClickAwayListener, Paper, Stack,
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
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import SearchIcon from '@mui/icons-material/Search'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api, type AdminNotification } from '../api'
import CircleIcon from '@mui/icons-material/Circle'
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined'
import VolumeOffOutlinedIcon from '@mui/icons-material/VolumeOffOutlined'
import { playNotifSound } from '../lib/notifySound'

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
    { to: '/admin/orders', label: 'Orders', icon: <ReceiptLongOutlinedIcon /> },
    { to: '/admin/users', label: 'Users', icon: <PeopleAltOutlinedIcon /> },
    { to: '/admin/sessions', label: 'Sessions', icon: <HistoryOutlinedIcon /> },
  ]},
  { group: 'System', links: [
    { to: '/admin/payments', label: 'Payments & fees', icon: <PaymentsOutlinedIcon /> },
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
  const searchShortcut = isMac ? '⌘ K' : 'Ctrl K'

  const crumb = loc.pathname.replace(/^\/admin\/?/, '') || 'dashboard'
  const crumbLabel = crumb.charAt(0).toUpperCase() + crumb.slice(1).replace(/-/g, ' ')
  const activeLink = items.flatMap(g => g.links).find(l => l.to === loc.pathname)
  const activeGroup = items.find(g => g.links.some(l => l.to === loc.pathname))?.group || 'Admin'

  // Top navbar state
  const [userMenuEl, setUserMenuEl] = useState<HTMLElement | null>(null)
  const [notifEl, setNotifEl] = useState<HTMLElement | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQ, setPaletteQ] = useState('')
  const paletteInputRef = useRef<HTMLInputElement>(null)
  const [notifs, setNotifs] = useState<AdminNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('admin-notif-muted') === '1' } catch { return false }
  })
  const mutedRef = useRef(muted)
  useEffect(() => { mutedRef.current = muted }, [muted])
  const toggleMute = () => {
    setMuted(m => {
      const next = !m
      try { localStorage.setItem('admin-notif-muted', next ? '1' : '0') } catch { /* ignore */ }
      if (!next) playNotifSound() // brief confirmation chime when un-muting
      return next
    })
  }

  const loadNotifs = useCallback(async () => {
    try {
      const res = await api.adminNotifications(20)
      setNotifs(res.items || [])
      setUnread(res.unread || 0)
    } catch { /* ignore */ }
  }, [])

  // Initial load + live stream via Server-Sent Events. No polling.
  useEffect(() => {
    loadNotifs()
    const es = new EventSource('/api/admin/notifications/stream')
    es.addEventListener('notification', (e) => {
      try {
        const n = JSON.parse((e as MessageEvent).data) as AdminNotification
        setNotifs(prev => [n, ...prev.filter(x => x.id !== n.id)].slice(0, 50))
        if (!n.readAt) {
          setUnread(u => u + 1)
          if (!mutedRef.current) playNotifSound()
        }
      } catch { /* ignore malformed event */ }
    })
    // EventSource auto-reconnects on transient errors; no manual handling needed.
    return () => es.close()
  }, [loadNotifs])

  const markAllRead = async () => {
    if (unread === 0) return
    try {
      await api.adminNotificationsRead()
      setUnread(0)
      setNotifs(prev => prev.map(n => n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
    } catch { /* ignore */ }
  }

  const onNotifClick = async (n: AdminNotification) => {
    setNotifEl(null)
    if (!n.readAt) {
      try {
        await api.adminNotificationsRead([n.id])
        setUnread(u => Math.max(0, u - 1))
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      } catch { /* ignore */ }
    }
    if (n.link) nav(n.link)
  }

  const flatNav = useMemo(() => items.flatMap(g => g.links.map(l => ({ ...l, group: g.group }))), [])
  const paletteResults = useMemo(() => {
    const q = paletteQ.trim().toLowerCase()
    if (!q) return flatNav
    return flatNav.filter(l =>
      l.label.toLowerCase().includes(q) ||
      l.group.toLowerCase().includes(q) ||
      l.to.includes(q)
    )
  }, [flatNav, paletteQ])

  // Cmd/Ctrl + K opens nav palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        setTimeout(() => paletteInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false); setPaletteQ('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  const goSignOut = async () => { setUserMenuEl(null); await signOut(); nav('/login') }

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
        <AppBar position="sticky" elevation={0} sx={{
          bgcolor: 'rgba(255,255,255,0.85)',
          color: 'text.primary',
          borderBottom: 1, borderColor: 'divider',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          top: 0, zIndex: 30,
        }}>
          <Toolbar sx={{ gap: 1.25, minHeight: 60, px: { xs: 1.5, md: 2.5 } }}>
            {/* Breadcrumb */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Chip label="Admin" size="small"
                sx={{
                  height: 22, fontWeight: 700, fontSize: 11,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
                  color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.06em',
                  border: '1px solid', borderColor: 'rgba(99,102,241,0.18)',
                  '& .MuiChip-label': { px: 1 },
                }} />
              <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>
                {activeGroup}
              </Typography>
              <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 14, color: 'text.primary', fontWeight: 700 }} noWrap>
                {activeLink?.label || crumbLabel}
              </Typography>
            </Box>

            {/* Spacer + center palette opener */}
            <Box sx={{ flex: 1 }} />
            <Box
              onClick={() => { setPaletteOpen(true); setTimeout(() => paletteInputRef.current?.focus(), 0) }}
              sx={{
                display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1,
                cursor: 'pointer', height: 36, minWidth: 280, maxWidth: 360,
                px: 1.25, borderRadius: 2,
                bgcolor: '#f1f5f9',
                border: '1px solid', borderColor: 'transparent',
                transition: 'background-color .15s, border-color .15s',
                '&:hover': { bgcolor: '#e2e8f0', borderColor: 'rgba(15,23,42,0.08)' },
              }}>
              <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 13, color: 'text.disabled', flex: 1 }}>
                Jump to page…
              </Typography>
              <Box component="kbd" sx={{
                fontSize: 10, fontWeight: 700, color: 'text.secondary',
                px: 0.75, py: 0.25, borderRadius: 1,
                bgcolor: '#fff', border: '1px solid', borderColor: 'rgba(15,23,42,0.08)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}>{searchShortcut}</Box>
            </Box>
            <Box sx={{ flex: 1 }} />

            {/* Right-side actions */}
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => window.location.reload()}
                sx={{ color: 'text.secondary' }}>
                <RefreshOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="View site">
              <IconButton size="small" component={RouterLink} to="/"
                sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title={muted ? 'Unmute notification sound' : 'Mute notification sound'}>
              <IconButton size="small" onClick={toggleMute}
                sx={{ color: muted ? 'error.main' : 'text.secondary' }}>
                {muted
                  ? <VolumeOffOutlinedIcon sx={{ fontSize: 20 }} />
                  : <VolumeUpOutlinedIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>

            <Tooltip title={unread > 0 ? `${unread} unread` : 'Notifications'}>
              <IconButton size="small" onClick={(e) => setNotifEl(e.currentTarget)}
                sx={{ color: 'text.secondary', position: 'relative' }}>
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 22 }} />
                {unread > 0 && (
                  <Box sx={{
                    position: 'absolute', top: 2, right: 2,
                    minWidth: 16, height: 16, px: 0.5, borderRadius: 99,
                    background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                    color: '#fff', fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #fff', lineHeight: 1,
                  }}>{unread > 99 ? '99+' : unread}</Box>
                )}
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />

            <Tooltip title="Account">
              <Box
                onClick={(e) => setUserMenuEl(e.currentTarget)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer',
                  px: 0.75, py: 0.5, borderRadius: 99,
                  transition: 'background-color .15s',
                  '&:hover': { bgcolor: '#f1f5f9' },
                }}>
                <Avatar src={user?.avatarPath || undefined}
                  sx={{
                    width: 32, height: 32,
                    bgcolor: theme.palette.primary.main, fontSize: 13, fontWeight: 700,
                    boxShadow: '0 0 0 2px rgba(99,102,241,0.18)',
                  }}>{initial}</Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0, mr: 0.5 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.1 }} noWrap>
                    {user?.displayName || user?.username}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {user?.role}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Notifications dropdown */}
        <Menu anchorEl={notifEl} open={!!notifEl} onClose={() => setNotifEl(null)}
          slotProps={{ paper: { sx: { minWidth: 360, maxWidth: 400, borderRadius: 2, mt: 1, p: 0 } } }}>
          <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Notifications</Typography>
              {unread > 0 && (
                <Chip size="small" label={`${unread} new`}
                  sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(225,29,72,0.12)', color: '#e11d48' }} />
              )}
            </Box>
            <IconButton size="small" onClick={markAllRead} disabled={unread === 0}
              sx={{ fontSize: 11, color: 'text.secondary' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600 }}>Mark all read</Typography>
            </IconButton>
          </Box>
          {notifs.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <NotificationsNoneOutlinedIcon sx={{ fontSize: 36, color: 'grey.300', mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>You're all caught up.</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>System events will show up here.</Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 420, overflowY: 'auto', py: 0.5 }}>
              {notifs.map(n => {
                const isUnread = !n.readAt
                return (
                  <Box key={n.id} onClick={() => onNotifClick(n)}
                    sx={{
                      px: 2, py: 1.25, cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: 1.25,
                      transition: 'background-color .1s',
                      bgcolor: isUnread ? 'rgba(99,102,241,0.04)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(99,102,241,0.08)' },
                    }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                      color: 'primary.main',
                    }}>
                      {kindIcon(n.kind)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, flex: 1 }} noWrap>
                          {n.title}
                        </Typography>
                        {isUnread && <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />}
                      </Stack>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary',
                        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                        overflow: 'hidden' }}>
                        {n.body}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>
                        {relTime(n.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </Menu>

        {/* User menu */}
        <Menu anchorEl={userMenuEl} open={!!userMenuEl} onClose={() => setUserMenuEl(null)}
          slotProps={{ paper: { sx: { minWidth: 220, borderRadius: 2, mt: 1 } } }}>
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>
              {user?.displayName || user?.username}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }} noWrap>
              {user?.email || '—'}
            </Typography>
          </Box>
          <Divider />
          <MenuItem component={RouterLink} to="/profile" onClick={() => setUserMenuEl(null)}>
            <ListItemIcon><PersonOutlineOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Profile" slotProps={{ primary: { sx: { fontSize: 14 } } }} />
          </MenuItem>
          <MenuItem component={RouterLink} to="/" onClick={() => setUserMenuEl(null)}>
            <ListItemIcon><HomeOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="View site" slotProps={{ primary: { sx: { fontSize: 14 } } }} />
          </MenuItem>
          <Divider />
          <MenuItem onClick={goSignOut} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'error.main' }}><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Sign out" slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 600 } } }} />
          </MenuItem>
        </Menu>

        {/* Command palette */}
        {paletteOpen && (
          <Box sx={{
            position: 'fixed', inset: 0, zIndex: 1500,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            pt: { xs: 6, md: 12 }, px: 2,
            bgcolor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
          }}>
            <ClickAwayListener onClickAway={() => { setPaletteOpen(false); setPaletteQ('') }}>
              <Paper elevation={12} sx={{
                width: '100%', maxWidth: 520, borderRadius: 3, overflow: 'hidden',
                boxShadow: '0 30px 80px -20px rgba(15,23,42,0.4)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                  <SearchIcon sx={{ color: 'text.disabled' }} />
                  <InputBase autoFocus inputRef={paletteInputRef}
                    placeholder="Jump to a page…"
                    value={paletteQ} onChange={e => setPaletteQ(e.target.value)}
                    sx={{ flex: 1, fontSize: 15 }} />
                  <Box component="kbd" sx={{
                    fontSize: 10, fontWeight: 700, color: 'text.secondary',
                    px: 0.75, py: 0.25, borderRadius: 1,
                    bgcolor: '#f1f5f9', border: '1px solid', borderColor: 'divider',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}>ESC</Box>
                </Box>
                <Box sx={{ maxHeight: 360, overflowY: 'auto', py: 0.5 }}>
                  {paletteResults.length === 0 ? (
                    <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                      No pages match "{paletteQ}".
                    </Typography>
                  ) : paletteResults.map((l) => (
                    <Box key={l.to}
                      onClick={() => { setPaletteOpen(false); setPaletteQ(''); nav(l.to) }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.25,
                        px: 2, py: 1.25, cursor: 'pointer',
                        transition: 'background-color .1s',
                        '&:hover': { bgcolor: 'rgba(99,102,241,0.06)' },
                      }}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: 1.5,
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
                        color: 'primary.main',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sizedIcon(l.icon, 16)}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} noWrap>{l.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled' }} noWrap>{l.group} · {l.to}</Typography>
                      </Box>
                      <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    </Box>
                  ))}
                </Box>
              </Paper>
            </ClickAwayListener>
          </Box>
        )}
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}

function kindIcon(kind: string) {
  switch (kind) {
    case 'product_created':
      return <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />
    default:
      return <NotificationsNoneOutlinedIcon sx={{ fontSize: 18 }} />
  }
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!isFinite(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}
