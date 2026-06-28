import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, IconButton, Divider, Tooltip,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PaymentsIcon from '@mui/icons-material/Payments'
import PersonIcon from '@mui/icons-material/Person'
import HomeIcon from '@mui/icons-material/Home'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

const FULL = 220, MINI = 64

const items = [
  { to: '/buyer/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/buyer/orders', label: 'Orders', icon: <ReceiptLongIcon /> },
  { to: '/buyer/addresses', label: 'Addresses', icon: <LocationOnIcon /> },
  { to: '/buyer/billing', label: 'Billing', icon: <PaymentsIcon /> },
  { to: '/buyer/profile', label: 'Profile', icon: <PersonIcon /> },
  { to: '/', label: 'Back to site', icon: <HomeIcon /> },
]

export default function BuyerLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('buyer-side-collapsed') === '1' } catch { return false }
  })
  const { user, signOut } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const width = collapsed ? MINI : FULL
  const initial = (user?.displayName || user?.username || '?')[0].toUpperCase()
  const toggle = () => setCollapsed(c => {
    const next = !c
    try { localStorage.setItem('buyer-side-collapsed', next ? '1' : '0') } catch {}
    return next
  })
  const crumb = loc.pathname.replace(/^\/buyer\/?/, '') || 'dashboard'
  const crumbLabel = crumb.charAt(0).toUpperCase() + crumb.slice(1)

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Drawer variant="permanent" sx={{
        width, flexShrink: 0, transition: 'width 0.2s',
        '& .MuiDrawer-paper': {
          width, boxSizing: 'border-box', bgcolor: '#1a2740', color: '#d7e0f0',
          border: 0, overflowX: 'hidden', transition: 'width 0.2s',
          position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        },
      }}>
        <Toolbar sx={{ minHeight: '64px !important', px: 2, gap: 1, borderBottom: '1px solid #2a3a5a' }}>
          {!collapsed && (
            <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: 18 }}>
              Smple<Box component="span" sx={{ color: '#6fb8ff' }}>Buy</Box>
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={toggle} sx={{ color: '#9bb0d6' }} size="small">
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
                      color: active ? '#fff' : '#d7e0f0',
                      bgcolor: active ? '#2a3a5a' : 'transparent',
                      borderLeft: 3, borderColor: active ? '#6fb8ff' : 'transparent',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      '&:hover': { bgcolor: '#2a3a5a', color: '#fff' },
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
        <Divider sx={{ borderColor: '#2a3a5a' }} />
        <Box sx={{ p: 1.5 }}>
          <Box component={RouterLink} to="/buyer/profile"
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1,
              textDecoration: 'none', color: '#fff', '&:hover': { bgcolor: '#2a3a5a' },
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}>
            <Avatar src={user?.avatarPath || undefined} sx={{ width: 32, height: 32, bgcolor: '#6fb8ff', color: '#1a2740', fontSize: 14 }}>{initial}</Avatar>
            {!collapsed && (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 11, color: '#9bb0d6' }}>Signed in</Typography>
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
              Buyer / <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{crumbLabel}</Box>
            </Typography>
            <Box component="span" sx={{ ml: 2, px: 1, py: 0.25, bgcolor: '#1a2740', color: '#6fb8ff', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 0.5 }}>Buyer</Box>
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={async () => { await signOut(); nav('/login') }} size="small">
              <Avatar src={user?.avatarPath || undefined} sx={{ width: 32, height: 32, bgcolor: '#1a2740', fontSize: 14 }}>{initial}</Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>{children}</Box>
      </Box>
    </Box>
  )
}
