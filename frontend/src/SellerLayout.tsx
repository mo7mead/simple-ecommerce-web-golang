import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, IconButton, Divider, Tooltip,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import HomeIcon from '@mui/icons-material/Home'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

const FULL = 220, MINI = 64

const items = [
  { to: '/seller/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/seller/products', label: 'Products', icon: <Inventory2Icon /> },
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
