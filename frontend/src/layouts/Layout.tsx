import {
  AppBar, Toolbar, Typography, Box, Avatar, Button, IconButton, Menu, MenuItem,
  Container, Stack, Tooltip, Divider, TextField, InputAdornment, Badge,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Collapse,
  Popper, Paper, ClickAwayListener, Grow, Select, Chip, useScrollTrigger, useMediaQuery, useTheme,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LogoutIcon from '@mui/icons-material/Logout'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PersonIcon from '@mui/icons-material/Person'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { Link as RouterLink, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api, type Category } from '../api'
import { CategoryIcon } from '../components/categoryIcons'
import { useCart } from '../contexts/CartContext'

const flatten = (cats: Category[]): Category[] => {
  const out: Category[] = []
  const walk = (c: Category) => { out.push(c); c.children?.forEach(walk) }
  cats.forEach(walk)
  return out
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, settings, signOut } = useAuth()
  const { count: cartCount } = useCart()
  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up('md'))
  const nav = useNavigate()

  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null)
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null)
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<string>('all')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [megaAnchor, setMegaAnchor] = useState<HTMLElement | null>(null)
  const [megaCat, setMegaCat] = useState<Category | null>(null)
  const [allMenuAnchor, setAllMenuAnchor] = useState<HTMLElement | null>(null)
  const closeMegaTimer = useRef<number | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerExpanded, setDrawerExpanded] = useState<Record<number, boolean>>({})

  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 80 })

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  const flatCats = useMemo(() => flatten(categories), [categories])
  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return flatCats
      .filter((c) => c.name.toLowerCase().includes(term))
      .slice(0, 8)
  }, [q, flatCats])

  const topLevel = categories.slice(0, 9)

  const initial = (user?.displayName || user?.username || '?')[0].toUpperCase()
  const brandInitial = (settings?.siteName || '?')[0].toUpperCase()

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    setSuggestOpen(false)
    const scopeQS = scope !== 'all' ? `&cat=${encodeURIComponent(scope)}` : ''
    nav(`/search?q=${encodeURIComponent(term)}${scopeQS}`)
  }

  const openMega = (el: HTMLElement, cat: Category) => {
    if (closeMegaTimer.current) { clearTimeout(closeMegaTimer.current); closeMegaTimer.current = null }
    setMegaAnchor(el); setMegaCat(cat)
  }
  const scheduleCloseMega = () => {
    if (closeMegaTimer.current) clearTimeout(closeMegaTimer.current)
    closeMegaTimer.current = window.setTimeout(() => { setMegaAnchor(null); setMegaCat(null) }, 150)
  }
  const cancelCloseMega = () => {
    if (closeMegaTimer.current) { clearTimeout(closeMegaTimer.current); closeMegaTimer.current = null }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Top utility strip */}
      <Box sx={{
        bgcolor: '#0b0d11', color: '#c9ced6', fontSize: 12,
        display: { xs: 'none', sm: 'block' },
      }}>
        <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', height: 32, gap: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <LocalShippingIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 12 }}>Free shipping over $50</Typography>
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <Typography sx={{ fontSize: 12, color: '#9aa0a6' }}>
            Summer sale — up to 40% off select categories
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', display: { xs: 'none', md: 'flex' } }}>
            <Box component={RouterLink} to="/help" sx={{ color: '#c9ced6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SupportAgentIcon sx={{ fontSize: 14 }} /> Help
            </Box>
            <Box component={RouterLink} to="/orders" sx={{ color: '#c9ced6', textDecoration: 'none' }}>
              Track order
            </Box>
            <Box component={RouterLink} to="/sell" sx={{ color: '#c9ced6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StorefrontIcon sx={{ fontSize: 14 }} /> Sell on {settings?.siteName || 'us'}
            </Box>
            <Chip label="EN · USD" size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'transparent', color: '#c9ced6', border: '1px solid rgba(255,255,255,0.15)' }} />
          </Stack>
        </Container>
      </Box>

      {/* Main bar */}
      <AppBar position="sticky" elevation={trigger ? 2 : 0} sx={{
        bgcolor: '#14171c', borderBottom: '1px solid #2a2e36',
        backdropFilter: 'saturate(140%) blur(6px)',
      }}>
        <Container maxWidth="lg" disableGutters>
          <Toolbar sx={{ gap: 2, px: { xs: 2, md: 3 }, minHeight: { xs: 60, md: 68 } }}>
            {!mdUp && (
              <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: '#fff', ml: -1 }} aria-label="Open menu">
                <MenuIcon />
              </IconButton>
            )}

            <Box component={RouterLink} to="/" sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'white', flexShrink: 0,
            }}>
              {settings?.logoPath ? (
                <Box component="img" src={settings.logoPath} alt="" sx={{ height: 36 }} />
              ) : (
                <Avatar sx={{
                  bgcolor: 'primary.main', width: 38, height: 38, fontWeight: 700, fontSize: 16,
                }}>{brandInitial}</Avatar>
              )}
            </Box>

            {/* Search */}
            <Box ref={searchRef} component="form" onSubmit={submitSearch} sx={{
              flex: 1, maxWidth: 720, mx: { xs: 0, md: 'auto' }, position: 'relative',
            }}>
              <Box sx={{
                display: 'flex', alignItems: 'stretch',
                bgcolor: '#fff', borderRadius: 2, overflow: 'hidden',
                outline: suggestOpen ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                transition: 'outline-color 120ms',
              }}>
                <Select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as string)}
                  variant="standard" disableUnderline
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    px: 1.5, fontSize: 13, color: '#475569', minWidth: 140,
                    borderRight: '1px solid #e2e8f0', bgcolor: '#f8fafc',
                    '& .MuiSelect-select': { py: 1, pr: 3 },
                  }}
                  MenuProps={{ slotProps: { paper: { sx: { maxHeight: 360 } } } }}
                >
                  <MenuItem value="all">All categories</MenuItem>
                  {topLevel.map((c) => (
                    <MenuItem key={c.id} value={c.slug}>
                      {c.icon && (
                        <Box component="span" sx={{ mr: 0.75, display: 'inline-flex', alignItems: 'center' }}>
                          <CategoryIcon name={c.icon} size={16} />
                        </Box>
                      )}
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small" fullWidth value={q}
                  onChange={(e) => { setQ(e.target.value); setSuggestOpen(true) }}
                  onFocus={() => setSuggestOpen(true)}
                  placeholder="Search products, brands, categories…"
                  variant="standard"
                  slotProps={{
                    input: {
                      disableUnderline: true,
                      startAdornment: (
                        <InputAdornment position="start" sx={{ pl: 1.5 }}>
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      sx: { color: '#0f172a', fontSize: 14, '& input': { py: 1.25 } },
                    },
                  }}
                />
                <Button type="submit" variant="contained" sx={{
                  borderRadius: 0, px: 3, textTransform: 'none', fontWeight: 600, boxShadow: 'none',
                  display: { xs: 'none', sm: 'inline-flex' },
                }}>
                  Search
                </Button>
              </Box>

              <Popper
                open={suggestOpen && suggestions.length > 0}
                anchorEl={searchRef.current}
                placement="bottom-start"
                style={{ zIndex: theme.zIndex.appBar + 2, width: searchRef.current?.clientWidth }}
                transition
              >
                {({ TransitionProps }) => (
                  <Grow {...TransitionProps}>
                    <Paper elevation={6} sx={{ mt: 0.5, borderRadius: 2, overflow: 'hidden' }}>
                      <ClickAwayListener onClickAway={() => setSuggestOpen(false)}>
                        <List dense sx={{ py: 0.5 }}>
                          {suggestions.map((s) => (
                            <ListItemButton
                              key={s.id}
                              onClick={() => {
                                setQ(s.name); setSuggestOpen(false)
                                nav(`/search?q=${encodeURIComponent(s.name)}`)
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 32, color: 'primary.main' }}>
                                {s.icon ? <CategoryIcon name={s.icon} size={18} /> : <SearchIcon sx={{ fontSize: 18, color: '#64748b' }} />}
                              </ListItemIcon>
                              <ListItemText
                                primary={s.name}
                                secondary={s.parentId ? 'in category' : 'top category'}
                                slotProps={{
                                  primary: { sx: { fontSize: 14 } },
                                  secondary: { sx: { fontSize: 11 } },
                                }}
                              />
                            </ListItemButton>
                          ))}
                        </List>
                      </ClickAwayListener>
                    </Paper>
                  </Grow>
                )}
              </Popper>
            </Box>

            {/* Action icons */}
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Tooltip title="Wishlist">
                <IconButton component={RouterLink} to="/wishlist" sx={{ color: '#fff', display: { xs: 'none', sm: 'inline-flex' } }}>
                  <Badge badgeContent={0} color="primary" showZero={false}>
                    <FavoriteBorderIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="Cart">
                <IconButton component={RouterLink} to="/cart" sx={{ color: '#fff' }}>
                  <Badge badgeContent={cartCount} color="primary" showZero={false}>
                    <ShoppingCartOutlinedIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              {user && (
                <Tooltip title="Notifications">
                  <IconButton onClick={(e) => setNotifAnchor(e.currentTarget)} sx={{ color: '#fff', display: { xs: 'none', sm: 'inline-flex' } }}>
                    <Badge badgeContent={0} color="primary" showZero={false}>
                      <NotificationsNoneIcon />
                    </Badge>
                  </IconButton>
                </Tooltip>
              )}
              <Menu anchorEl={notifAnchor} open={!!notifAnchor} onClose={() => setNotifAnchor(null)}
                slotProps={{ paper: { sx: { width: 320, mt: 1 } } }}>
                <MenuItem disabled sx={{ opacity: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Notifications</Typography>
                </MenuItem>
                <Divider />
                <MenuItem sx={{ py: 2 }}>
                  <Stack>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>You're all caught up</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>No new notifications</Typography>
                  </Stack>
                </MenuItem>
              </Menu>

              {user ? (
                <>
                  <Tooltip title="Account">
                    <IconButton onClick={(e) => setAccountAnchor(e.currentTarget)} sx={{ p: 0.5, ml: 0.5 }}>
                      <Avatar
                        src={user.avatarPath || undefined}
                        sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontWeight: 700 }}
                      >{initial}</Avatar>
                    </IconButton>
                  </Tooltip>
                  <Menu anchorEl={accountAnchor} open={!!accountAnchor} onClose={() => setAccountAnchor(null)}
                    slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}>
                    <MenuItem disabled sx={{ opacity: 1 }}>
                      <Stack>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{user.displayName || user.username}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>@{user.username} · {user.role}</Typography>
                      </Stack>
                    </MenuItem>
                    <Divider />
                    <MenuItem component={RouterLink} to="/profile" onClick={() => setAccountAnchor(null)}>
                      <PersonIcon sx={{ mr: 1, fontSize: 18 }} /> Profile
                    </MenuItem>
                    <MenuItem component={RouterLink} to={`/${user.role}/dashboard`} onClick={() => setAccountAnchor(null)}>
                      <DashboardIcon sx={{ mr: 1, fontSize: 18 }} /> Dashboard
                    </MenuItem>
                    <MenuItem component={RouterLink} to="/orders" onClick={() => setAccountAnchor(null)}>
                      <LocalShippingIcon sx={{ mr: 1, fontSize: 18 }} /> Orders
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={async () => { setAccountAnchor(null); await signOut(); nav('/login') }}>
                      <LogoutIcon sx={{ mr: 1, fontSize: 18 }} /> Sign out
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Stack direction="row" spacing={1} sx={{ ml: 1 }}>
                  <Button component={RouterLink} to="/login" variant="text" sx={{
                    color: '#fff', textTransform: 'none', fontWeight: 600,
                    display: { xs: 'none', sm: 'inline-flex' },
                  }}>
                    Sign in
                  </Button>
                  <Button component={RouterLink} to="/login" variant="contained" sx={{
                    textTransform: 'none', fontWeight: 600, boxShadow: 'none',
                  }}>
                    {mdUp ? 'Get started' : 'Sign in'}
                  </Button>
                </Stack>
              )}
            </Stack>
          </Toolbar>

          {/* Category strip */}
          <Box sx={{
            display: { xs: 'none', md: 'block' },
            borderTop: '1px solid #2a2e36',
          }}>
            <Container maxWidth="lg" disableGutters>
              <Stack direction="row" sx={{ alignItems: 'center', height: 44, px: 1, gap: 0.5, overflow: 'hidden' }}>
                <Button
                  onClick={(e) => setAllMenuAnchor(e.currentTarget)}
                  startIcon={<MenuIcon />}
                  endIcon={<KeyboardArrowDownIcon />}
                  sx={{
                    color: '#fff', textTransform: 'none', fontWeight: 600, mr: 1,
                    bgcolor: 'rgba(255,255,255,0.06)', px: 1.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                  }}
                >
                  All categories
                </Button>
                <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2e36', mx: 0.5, my: 1 }} />

                {[
                  { to: '/', label: 'Home', end: true },
                  { to: '/deals', label: 'Today’s deals' },
                  { to: '/new', label: 'New arrivals' },
                ].map((l) => (
                  <Button
                    key={l.to}
                    component={NavLink}
                    to={l.to}
                    end={l.end as boolean | undefined}
                    sx={{
                      color: '#c9ced6', fontWeight: 500, textTransform: 'none', fontSize: 13.5,
                      '&.active': { color: 'primary.light' },
                    }}
                  >{l.label}</Button>
                ))}

                <Box sx={{ flex: 1, display: 'flex', gap: 0.25, overflow: 'hidden' }}>
                  {topLevel.map((c) => (
                    <Button
                      key={c.id}
                      onMouseEnter={(e) => openMega(e.currentTarget, c)}
                      onMouseLeave={scheduleCloseMega}
                      onClick={() => nav(`/category/${c.slug}`)}
                      sx={{
                        color: '#c9ced6', fontWeight: 500, textTransform: 'none', fontSize: 13.5,
                        whiteSpace: 'nowrap', minWidth: 'auto',
                        '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
                      }}
                    >
                      {c.icon && (
                        <Box component="span" sx={{ mr: 0.5, display: 'inline-flex', alignItems: 'center' }}>
                          <CategoryIcon name={c.icon} size={16} />
                        </Box>
                      )}
                      {c.name}
                    </Button>
                  ))}
                </Box>

                {user && (
                  <Button
                    component={NavLink}
                    to={`/${user.role}/dashboard`}
                    sx={{
                      color: '#c9ced6', fontWeight: 600, textTransform: 'none', fontSize: 13.5,
                      '&.active': { color: 'primary.light' },
                    }}
                  >
                    {user.role === 'seller' ? 'Seller console' : user.role === 'buyer' ? 'My account' : 'Admin'}
                  </Button>
                )}
              </Stack>
            </Container>
          </Box>
        </Container>

        {/* Mega menu popper */}
        <Popper
          open={!!megaAnchor && !!megaCat?.children?.length}
          anchorEl={megaAnchor}
          placement="bottom-start"
          style={{ zIndex: theme.zIndex.appBar + 1 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
          transition
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps}>
              <Paper
                elevation={8}
                onMouseEnter={cancelCloseMega}
                onMouseLeave={scheduleCloseMega}
                sx={{
                  p: 3, minWidth: 560, maxWidth: 880, borderRadius: 2,
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3,
                }}
              >
                {(megaCat?.children || []).slice(0, 9).map((sub) => (
                  <Box key={sub.id}>
                    <Box
                      component={RouterLink}
                      to={`/category/${sub.slug}`}
                      onClick={() => { setMegaAnchor(null); setMegaCat(null) }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, mb: 1,
                        color: 'text.primary', textDecoration: 'none', fontWeight: 700, fontSize: 14,
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', color: 'primary.main' }}>
                        {sub.icon ? <CategoryIcon name={sub.icon} size={18} /> : <Box component="span">•</Box>}
                      </Box>
                      {sub.name}
                    </Box>
                    <Stack spacing={0.5}>
                      {(sub.children || []).slice(0, 6).map((leaf) => (
                        <Box
                          key={leaf.id}
                          component={RouterLink}
                          to={`/category/${leaf.slug}`}
                          onClick={() => { setMegaAnchor(null); setMegaCat(null) }}
                          sx={{
                            color: 'text.secondary', fontSize: 13, textDecoration: 'none',
                            '&:hover': { color: 'primary.main' },
                          }}
                        >
                          {leaf.name}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Paper>
            </Grow>
          )}
        </Popper>

        {/* All-categories full list dropdown */}
        <Menu
          anchorEl={allMenuAnchor}
          open={!!allMenuAnchor}
          onClose={() => setAllMenuAnchor(null)}
          slotProps={{ paper: { sx: { maxHeight: 480, minWidth: 280, mt: 1 } } }}
        >
          {categories.map((c) => (
            <MenuItem
              key={c.id}
              onClick={() => { setAllMenuAnchor(null); nav(`/category/${c.slug}`) }}
              sx={{ fontSize: 14 }}
            >
              <Box component="span" sx={{ mr: 1.5, width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                {c.icon ? <CategoryIcon name={c.icon} size={18} /> : <Box component="span">•</Box>}
              </Box>
              {c.name}
            </MenuItem>
          ))}
        </Menu>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} slotProps={{ paper: { sx: { width: 320 } } }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: '1px solid #e5e7eb' }}>
          <Typography sx={{ fontWeight: 700 }}>{settings?.siteName || 'Menu'}</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close menu"><CloseIcon /></IconButton>
        </Stack>
        {!user && (
          <Box sx={{ p: 2 }}>
            <Button fullWidth variant="contained" component={RouterLink} to="/login"
              onClick={() => setDrawerOpen(false)}
              sx={{ textTransform: 'none', fontWeight: 600 }}>
              Sign in / Sign up
            </Button>
          </Box>
        )}
        <List sx={{ pt: 0 }}>
          <ListItemButton component={RouterLink} to="/" onClick={() => setDrawerOpen(false)}>
            <ListItemText primary="Home" />
          </ListItemButton>
          <ListItemButton component={RouterLink} to="/deals" onClick={() => setDrawerOpen(false)}>
            <ListItemText primary="Today's deals" />
          </ListItemButton>
          <ListItemButton component={RouterLink} to="/new" onClick={() => setDrawerOpen(false)}>
            <ListItemText primary="New arrivals" />
          </ListItemButton>
          <Divider sx={{ my: 1 }} />
          <Typography sx={{ px: 2, py: 0.5, fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Categories
          </Typography>
          {categories.map((c) => {
            const open = !!drawerExpanded[c.id]
            const hasKids = !!c.children?.length
            return (
              <Box key={c.id}>
                <ListItemButton
                  onClick={() => {
                    if (hasKids) setDrawerExpanded((m) => ({ ...m, [c.id]: !open }))
                    else { nav(`/category/${c.slug}`); setDrawerOpen(false) }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: 'primary.main' }}>
                    {c.icon ? <CategoryIcon name={c.icon} size={20} /> : <Box component="span" sx={{ fontSize: 18 }}>•</Box>}
                  </ListItemIcon>
                  <ListItemText primary={c.name} />
                  {hasKids && (open ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
                </ListItemButton>
                {hasKids && (
                  <Collapse in={open} unmountOnExit>
                    <List dense disablePadding>
                      {c.children!.map((sub) => (
                        <ListItemButton
                          key={sub.id}
                          sx={{ pl: 6 }}
                          component={RouterLink}
                          to={`/category/${sub.slug}`}
                          onClick={() => setDrawerOpen(false)}
                        >
                          <ListItemText primary={sub.name} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Box>
            )
          })}
          {user && (
            <>
              <Divider sx={{ my: 1 }} />
              <ListItemButton component={RouterLink} to="/profile" onClick={() => setDrawerOpen(false)}>
                <ListItemIcon sx={{ minWidth: 32 }}><PersonIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Profile" />
              </ListItemButton>
              <ListItemButton component={RouterLink} to={`/${user.role}/dashboard`} onClick={() => setDrawerOpen(false)}>
                <ListItemIcon sx={{ minWidth: 32 }}><DashboardIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Dashboard" />
              </ListItemButton>
              <ListItemButton onClick={async () => { setDrawerOpen(false); await signOut(); nav('/login') }}>
                <ListItemIcon sx={{ minWidth: 32 }}><LogoutIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Sign out" />
              </ListItemButton>
            </>
          )}
        </List>
      </Drawer>

      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        {children}
      </Container>

      <Box component="footer" sx={{ bgcolor: '#14171c', color: '#9aa0a6', py: 2, textAlign: 'center', fontSize: 13 }}>
        © 2026 {settings?.siteName || 'Simple Web App'} · Built with React + Go
      </Box>
    </Box>
  )
}
