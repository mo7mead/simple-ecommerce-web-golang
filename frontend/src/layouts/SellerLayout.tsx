import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, IconButton, Divider, Tooltip,
  Badge, Menu, MenuItem, Stack, Button,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import HomeIcon from '@mui/icons-material/Home'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import CircleIcon from '@mui/icons-material/Circle'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api, type AdminNotification } from '../api'

const FULL = 220, MINI = 64

const items = [
  { to: '/seller/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/seller/products', label: 'Products', icon: <Inventory2Icon /> },
  { to: '/seller/orders', label: 'Orders', icon: <ReceiptLongIcon /> },
  { to: '/', label: 'Back to site', icon: <HomeIcon /> },
]

export default function SellerLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('seller-side-collapsed') === '1' } catch { return false }
  })
  const { user, signOut } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const width = collapsed ? MINI : FULL
  const initial = (user?.displayName || user?.username || '?')[0].toUpperCase()
  const toggle = () => setCollapsed(c => {
    const next = !c
    try { localStorage.setItem('seller-side-collapsed', next ? '1' : '0') } catch {}
    return next
  })
  const crumb = loc.pathname.replace(/^\/seller\/?/, '') || 'dashboard'
  const crumbLabel = crumb.charAt(0).toUpperCase() + crumb.slice(1)

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Drawer variant="permanent" sx={{
        width, flexShrink: 0, transition: 'width 0.2s',
        '& .MuiDrawer-paper': {
          width, boxSizing: 'border-box', bgcolor: '#0f4c3a', color: '#d7e6df',
          border: 0, overflowX: 'hidden', transition: 'width 0.2s',
          position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        },
      }}>
        <Toolbar sx={{ minHeight: '64px !important', px: 2, gap: 1, borderBottom: '1px solid #1a6650' }}>
          {!collapsed && (
            <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: 18 }}>
              Smple<Box component="span" sx={{ color: '#6fdcb6' }}>Sell</Box>
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={toggle} sx={{ color: '#9bbfb0' }} size="small">
            <MenuOpenIcon sx={{ transform: collapsed ? 'rotate(180deg)' : 'none' }} />
          </IconButton>
        </Toolbar>
        <Box sx={{ flex: 1 }}>
          <List dense>
            {items.map(l => {
              const active = loc.pathname === l.to
              return (
                <ListItem key={l.to} disablePadding>
                  <Tooltip title={collapsed ? l.label : ''} placement="right">
                    <ListItemButton component={RouterLink} to={l.to} sx={{
                      color: active ? '#fff' : '#d7e6df',
                      bgcolor: active ? '#1a6650' : 'transparent',
                      borderLeft: 3, borderColor: active ? '#6fdcb6' : 'transparent',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      '&:hover': { bgcolor: '#1a6650', color: '#fff' },
                    }}>
                      <ListItemIcon sx={{ color: 'inherit', minWidth: collapsed ? 'auto' : 36 }}>{l.icon}</ListItemIcon>
                      {!collapsed && <ListItemText primary={l.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              )
            })}
          </List>
        </Box>
        <Divider sx={{ borderColor: '#1a6650' }} />
        <Box sx={{ p: 1.5 }}>
          <Box component={RouterLink} to="/profile"
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1,
              textDecoration: 'none', color: '#fff', '&:hover': { bgcolor: '#1a6650' },
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}>
            <Avatar src={user?.avatarPath || undefined} sx={{ width: 32, height: 32, bgcolor: '#6fdcb6', color: '#0f4c3a', fontSize: 14 }}>{initial}</Avatar>
            {!collapsed && (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 11, color: '#9bbfb0' }}>Signed in</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user?.displayName || user?.username}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: '#fff', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar>
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
              Seller / <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{crumbLabel}</Box>
            </Typography>
            <Box component="span" sx={{ ml: 2, px: 1, py: 0.25, bgcolor: '#0f4c3a', color: '#6fdcb6', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 0.5 }}>Seller</Box>
            <Box sx={{ flex: 1 }} />
            <NotificationBell />
            <IconButton onClick={async () => { await signOut(); nav('/login') }} size="small">
              <Avatar src={user?.avatarPath || undefined} sx={{ width: 32, height: 32, bgcolor: '#0f4c3a', fontSize: 14 }}>{initial}</Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>{children}</Box>
      </Box>
    </Box>
  )
}

function NotificationBell() {
  const [items, setItems] = useState<AdminNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const nav = useNavigate()
  const prevUnread = useRef(0)

  const refresh = useCallback(async () => {
    try {
      const r = await api.sellerNotifications(20)
      setItems(r.items || [])
      setUnread(r.unread)
    } catch { /* keep last state */ }
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 30_000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    prevUnread.current = unread
  }, [unread])

  const openMenu = async (e: React.MouseEvent<HTMLElement>) => {
    setAnchor(e.currentTarget)
    await refresh()
  }
  const closeMenu = () => setAnchor(null)

  const handleClick = async (n: AdminNotification) => {
    closeMenu()
    if (!n.readAt) {
      try {
        await api.sellerNotificationsRead([n.id])
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
        setUnread(u => Math.max(0, u - 1))
      } catch { /* ignore */ }
    }
    if (n.link) nav(n.link)
  }

  const markAllRead = async () => {
    try {
      await api.sellerNotificationsRead()
      setItems(prev => prev.map(x => ({ ...x, readAt: x.readAt || new Date().toISOString() })))
      setUnread(0)
    } catch { /* ignore */ }
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={openMenu} size="small" sx={{ mr: 0.5 }} aria-label="Notifications">
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor} open={!!anchor} onClose={closeMenu}
        slotProps={{ paper: { sx: { width: 360, maxHeight: 480, mt: 1 } } }}
      >
        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 700, flex: 1 }}>Notifications</Typography>
          {unread > 0 && (
            <Button size="small" onClick={markAllRead}>Mark all read</Button>
          )}
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsNoneIcon sx={{ fontSize: 32, color: '#cbd5e1', mb: 1 }} />
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              You're all caught up.
            </Typography>
          </Box>
        ) : (
          items.map(n => (
            <MenuItem key={n.id} onClick={() => handleClick(n)}
              sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1.25 }}>
              <Box sx={{ width: 8, mt: 0.75, mr: 1.25, flexShrink: 0 }}>
                {!n.readAt && <CircleIcon sx={{ fontSize: 8, color: 'error.main' }} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: n.readAt ? 500 : 700 }}>
                  {n.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {n.body}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>
                  {timeAgo(n.createdAt)}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - +new Date(iso)
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
