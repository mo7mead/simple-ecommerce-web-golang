import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Stack, Grid, Button, Chip, Divider,
  Avatar, LinearProgress, IconButton, Tooltip,
} from '@mui/material'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import PaidIcon from '@mui/icons-material/Paid'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import PersonIcon from '@mui/icons-material/Person'
import EmailIcon from '@mui/icons-material/Email'
import LockIcon from '@mui/icons-material/Lock'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import StorefrontIcon from '@mui/icons-material/Storefront'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { api, type Address, type Order, type Product } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'

const STATUS_COLOR: Record<Order['status'], 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning', shipped: 'info', delivered: 'success', cancelled: 'error',
}

export default function BuyerDashboard() {
  const { user } = useAuth()
  const { count: cartCount } = useCart()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    api.myOrders().then(r => setOrders(r || [])).catch(() => setOrders([]))
    api.addresses().then(r => setAddresses(r || [])).catch(() => setAddresses([]))
    api.products().then(r => setProducts(r || [])).catch(() => setProducts([]))
  }, [])

  const stats = useMemo(() => {
    const list = orders || []
    const byStatus = { pending: 0, shipped: 0, delivered: 0, cancelled: 0 }
    let spent = 0
    for (const o of list) { byStatus[o.status]++; spent += o.total }
    return {
      count: list.length,
      spent,
      open: byStatus.pending + byStatus.shipped,
      byStatus,
    }
  }, [orders])

  const recent = (orders || []).slice(0, 5)
  const activeShipments = (orders || []).filter(o => o.status === 'shipped').slice(0, 3)
  const defaultAddr = (addresses || []).find(a => a.isDefault) || (addresses || [])[0]
  const recommended = (products || []).slice(0, 6)
  const monthly = useMemo(() => monthlySpend(orders || []), [orders])

  const checklist = [
    { key: 'avatar', label: 'Upload avatar', done: !!user?.avatarPath, icon: <PersonIcon />, to: '/buyer/profile' },
    { key: 'email', label: 'Add email', done: !!user?.email, icon: <EmailIcon />, to: '/buyer/profile' },
    { key: 'address', label: 'Save an address', done: (addresses?.length ?? 0) > 0, icon: <LocationOnIcon />, to: '/buyer/addresses' },
    { key: 'order', label: 'Place first order', done: (orders?.length ?? 0) > 0, icon: <ReceiptLongIcon />, to: '/' },
  ]
  const completionPct = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100)

  return (
    <Stack spacing={3}>
      <HeroCard user={user} memberSince={user?.createdAt} completionPct={completionPct} />

      <Grid container spacing={2}>
        <StatTile label="Orders" value={stats.count} icon={<ReceiptLongIcon />} accent="#1a2740" />
        <StatTile label="Active shipments" value={stats.byStatus.shipped} icon={<LocalShippingIcon />} accent="#0288d1" />
        <StatTile label="Lifetime spend" value={`$${stats.spent.toFixed(2)}`} icon={<PaidIcon />} accent="#2e7d32" />
        <StatTile label="Saved addresses" value={addresses?.length ?? 0} icon={<LocationOnIcon />} accent="#ed6c02" />
        <StatTile label="In cart" value={cartCount} icon={<ShoppingCartIcon />} accent="#7b1fa2" />
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            <ActiveShipmentsCard shipments={activeShipments} loading={orders === null} />
            <RecentOrdersCard recent={recent} loading={orders === null} />
            <SpendingCard monthly={monthly} />
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <ChecklistCard items={checklist} pct={completionPct} />
            <DefaultAddressCard addr={defaultAddr} loading={addresses === null} />
            <StatusBreakdownCard byStatus={stats.byStatus} total={stats.count} />
          </Stack>
        </Grid>
      </Grid>

      <RecommendedCard products={recommended} loading={products === null} />
    </Stack>
  )
}

/* -------- Sub-components -------- */

function HeroCard({ user, memberSince, completionPct }:
  { user: ReturnType<typeof useAuth>['user']; memberSince?: string; completionPct: number }) {
  const initial = (user?.displayName || user?.username || '?')[0].toUpperCase()
  return (
    <Card sx={{
      background: 'linear-gradient(135deg, #1a2740 0%, #2a3f6e 100%)',
      color: '#fff', overflow: 'hidden', position: 'relative',
    }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Avatar src={user?.avatarPath || undefined} sx={{
            width: 72, height: 72, fontSize: 28, fontWeight: 700,
            bgcolor: '#6fb8ff', color: '#1a2740', border: '3px solid rgba(255,255,255,0.2)',
          }}>{initial}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, color: '#9bb0d6', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.5 }}>
              Buyer dashboard
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Welcome back, {user?.displayName || user?.username}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {memberSince && (
                <Chip size="small" label={`Member since ${new Date(memberSince).toLocaleDateString()}`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }} />
              )}
              <Chip size="small" label={`Profile ${completionPct}% complete`}
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/" variant="contained" color="primary"
              startIcon={<StorefrontIcon />}>Browse</Button>
            <Button component={RouterLink} to="/buyer/orders" variant="outlined"
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>My orders</Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function StatTile({ label, value, icon, accent }:
  { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: accent, color: '#fff', width: 40, height: 40 }}>{icon}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  )
}

function ActiveShipmentsCard({ shipments, loading }: { shipments: Order[]; loading: boolean }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <LocalShippingIcon color="info" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Active shipments</Typography>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/buyer/orders" size="small" endIcon={<ArrowForwardIcon />}>View all</Button>
        </Stack>
        {loading ? (
          <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>
        ) : shipments.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
            No active shipments. Once your order ships you'll see it here.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {shipments.map(o => (
              <Box key={o.id} sx={{
                p: 2, borderRadius: 2, border: 1, borderColor: 'divider',
                bgcolor: '#f8fafc',
              }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{
                    width: 44, height: 44, borderRadius: '50%', bgcolor: '#0288d1', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <LocalShippingIcon />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
                      {o.ref || `#${o.id}`}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {o.items.length} item{o.items.length === 1 ? '' : 's'} · ${o.total.toFixed(2)} · placed {new Date(o.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip size="small" label="In transit" color="info" />
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function RecentOrdersCard({ recent, loading }: { recent: Order[]; loading: boolean }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent orders</Typography>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/buyer/orders" size="small">View all</Button>
        </Stack>
        {loading ? (
          <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>
        ) : recent.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>No orders yet.</Typography>
            <Button component={RouterLink} to="/" variant="contained">Start shopping</Button>
          </Box>
        ) : (
          <Stack divider={<Divider flexItem />}>
            {recent.map(o => (
              <Stack key={o.id} direction="row" spacing={2} alignItems="center" sx={{ py: 1.5 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
                    {o.ref || `#${o.id}`}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} item{o.items.length === 1 ? '' : 's'}
                  </Typography>
                </Box>
                <Chip size="small" label={o.status} color={STATUS_COLOR[o.status]} />
                <Typography sx={{ fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                  ${o.total.toFixed(2)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function SpendingCard({ monthly }: { monthly: { label: string; value: number }[] }) {
  const max = Math.max(1, ...monthly.map(m => m.value))
  const total = monthly.reduce((s, m) => s + m.value, 0)
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <PaidIcon color="success" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Spending · last 6 months</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>${total.toFixed(2)}</Typography>
        </Stack>
        <Box sx={{
          display: 'grid', gridTemplateColumns: `repeat(${monthly.length}, 1fr)`,
          gap: 1.5, alignItems: 'end', height: 140,
        }}>
          {monthly.map(m => (
            <Box key={m.label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={`$${m.value.toFixed(2)}`}>
                <Box sx={{
                  width: '100%', minHeight: 4,
                  height: `${Math.max(4, (m.value / max) * 100)}%`,
                  background: m.value > 0
                    ? 'linear-gradient(180deg, #6fb8ff, #1a2740)'
                    : '#e2e8f0',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.3s',
                }} />
              </Tooltip>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{m.label}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

function ChecklistCard({ items, pct }:
  { items: { key: string; label: string; done: boolean; icon: React.ReactNode; to: string }[]; pct: number }) {
  const allDone = pct === 100
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Account setup</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
          {allDone ? 'All set — you\'re good to go.' : `${pct}% complete`}
        </Typography>
        <LinearProgress variant="determinate" value={pct} sx={{ mb: 2, height: 6, borderRadius: 1 }} />
        <Stack spacing={0.5}>
          {items.map(it => (
            <Stack key={it.key} component={RouterLink} to={it.to} direction="row" alignItems="center" spacing={1.5}
              sx={{
                textDecoration: 'none', color: it.done ? 'text.disabled' : 'text.primary',
                p: 1, borderRadius: 1, '&:hover': { bgcolor: '#f1f5f9' },
              }}>
              {it.done
                ? <CheckCircleIcon color="success" fontSize="small" />
                : <RadioButtonUncheckedIcon color="action" fontSize="small" />}
              <Box sx={{ flex: 1, fontSize: 14, textDecoration: it.done ? 'line-through' : 'none' }}>{it.label}</Box>
              <Box sx={{ color: 'text.secondary' }}>{it.icon}</Box>
            </Stack>
          ))}
          <Divider sx={{ my: 1 }} />
          <Stack component={RouterLink} to="/buyer/profile" direction="row" alignItems="center" spacing={1.5}
            sx={{ textDecoration: 'none', color: 'text.secondary', p: 1, fontSize: 13, '&:hover': { color: 'primary.main' } }}>
            <LockIcon fontSize="small" />
            <Box sx={{ flex: 1 }}>Update password</Box>
            <ArrowForwardIcon fontSize="small" />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function DefaultAddressCard({ addr, loading }: { addr?: Address; loading: boolean }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <LocationOnIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Default address</Typography>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/buyer/addresses" size="small">Manage</Button>
        </Stack>
        {loading ? (
          <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>
        ) : addr ? (
          <Stack spacing={0.5}>
            {addr.label && <Chip size="small" label={addr.label} sx={{ alignSelf: 'flex-start' }} />}
            <Typography sx={{ fontWeight: 600 }}>{addr.recipient}</Typography>
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{addr.phone}</Typography>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{addr.line}</Typography>
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>No saved address yet.</Typography>
            <Button component={RouterLink} to="/buyer/addresses" variant="contained" size="small">Add address</Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBreakdownCard({ byStatus, total }:
  { byStatus: Record<Order['status'], number>; total: number }) {
  const segments: { key: Order['status']; color: string }[] = [
    { key: 'pending',   color: '#ed6c02' },
    { key: 'shipped',   color: '#0288d1' },
    { key: 'delivered', color: '#2e7d32' },
    { key: 'cancelled', color: '#d32f2f' },
  ]
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Order status</Typography>
        {total === 0 ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>No orders to summarize yet.</Typography>
        ) : (
          <>
            <Box sx={{
              display: 'flex', height: 10, borderRadius: 1, overflow: 'hidden', mb: 2,
              bgcolor: '#e2e8f0',
            }}>
              {segments.map(s => byStatus[s.key] > 0 && (
                <Box key={s.key} sx={{
                  flex: byStatus[s.key], bgcolor: s.color,
                }} />
              ))}
            </Box>
            <Stack spacing={0.75}>
              {segments.map(s => (
                <Stack key={s.key} direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                  <Typography sx={{ fontSize: 13, textTransform: 'capitalize', flex: 1 }}>{s.key}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{byStatus[s.key]}</Typography>
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RecommendedCard({ products, loading }: { products: Product[]; loading: boolean }) {
  if (loading || products.length === 0) return null
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <StorefrontIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>You might like</Typography>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/" size="small" endIcon={<ArrowForwardIcon />}>Browse all</Button>
        </Stack>
        <Box sx={{
          display: 'grid', gap: 2,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
        }}>
          {products.map(p => (
            <Box key={p.id} component={RouterLink} to={`/products/${p.id}`}
              sx={{
                textDecoration: 'none', color: 'inherit',
                borderRadius: 2, overflow: 'hidden', bgcolor: '#fafbfc',
                border: 1, borderColor: 'divider',
                transition: 'transform 0.15s, box-shadow 0.15s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
              }}>
              <Box sx={{
                width: '100%', aspectRatio: '1 / 1', bgcolor: '#f1f5f9',
                backgroundImage: p.imagePath ? `url(${p.imagePath})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#cbd5e1', fontWeight: 700, fontSize: 28,
              }}>{!p.imagePath && (p.name[0]?.toUpperCase() ?? '?')}</Box>
              <Box sx={{ p: 1.25 }}>
                <Typography sx={{
                  fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{p.name}</Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main' }}>
                    ${p.price.toFixed(2)}
                  </Typography>
                  <Tooltip title="Add to cart">
                    <IconButton size="small" component={RouterLink} to="/cart"
                      onClick={(e) => e.stopPropagation()}>
                      <ShoppingCartIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

/* -------- Helpers -------- */

function monthlySpend(orders: Order[]): { label: string; value: number }[] {
  const now = new Date()
  const buckets: { key: string; label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      value: 0,
    })
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  for (const o of orders) {
    const d = new Date(o.createdAt)
    const k = `${d.getFullYear()}-${d.getMonth()}`
    const i = idx.get(k)
    if (i !== undefined && o.status !== 'cancelled') buckets[i].value += o.total
  }
  return buckets
}
