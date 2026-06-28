import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Stack, Grid, Button, Chip, Divider, Avatar,
  Paper, Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PaidIcon from '@mui/icons-material/Paid'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AddIcon from '@mui/icons-material/Add'
import { api, type SellerOrder } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_COLOR: Record<SellerOrder['status'], 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning', shipped: 'info', delivered: 'success', cancelled: 'error',
}

type SellerStats = {
  TotalProducts?: number
  TotalStock?: number
  InventoryValue?: number
  RecentProducts?: { ID: number; Name: string; Price: number; Stock: number; CreatedAt: string }[]
}

export default function SellerDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<SellerStats | null>(null)
  const [orders, setOrders] = useState<SellerOrder[] | null>(null)

  useEffect(() => {
    api.sellerStats().then(setStats).catch(() => setStats({}))
    api.sellerOrders().then(r => setOrders(r || [])).catch(() => setOrders([]))
  }, [])

  const orderStats = useMemo(() => {
    const c = { pending: 0, shipped: 0, delivered: 0, cancelled: 0 }
    let revenue = 0
    let units = 0
    for (const o of orders || []) {
      c[o.status]++
      if (o.status !== 'cancelled') {
        revenue += o.subtotal
        units += o.items.reduce((s, it) => s + it.qty, 0)
      }
    }
    return { ...c, revenue, units, total: (orders || []).length }
  }, [orders])

  const recentOrders = (orders || []).slice(0, 5)
  if (!user) return null

  return (
    <Stack spacing={3}>
      <Hero user={user} pending={orderStats.pending} />

      <Grid container spacing={2}>
        <StatTile label="Awaiting fulfillment" value={orderStats.pending}
          icon={<PendingActionsIcon />} accent="#ed6c02" hint="Pending orders" />
        <StatTile label="In transit" value={orderStats.shipped}
          icon={<LocalShippingIcon />} accent="#0288d1" hint="Shipped, not yet delivered" />
        <StatTile label="Delivered" value={orderStats.delivered}
          icon={<CheckCircleIcon />} accent="#2e7d32" hint="Completed orders" />
        <StatTile label="Revenue" value={`$${orderStats.revenue.toFixed(2)}`}
          icon={<PaidIcon />} accent="#1a6650" hint="Your items, excl. cancelled" />
        <StatTile label="Units sold" value={orderStats.units}
          icon={<ReceiptLongIcon />} accent="#7b1fa2" hint="Total items shipped to buyers" />
        <StatTile label="Active products" value={stats?.TotalProducts ?? 0}
          icon={<Inventory2Icon />} accent="#1a2740" hint={`Stock: ${stats?.TotalStock ?? 0} units`} />
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <RecentOrdersCard orders={recentOrders} loading={orders === null} />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <StatusBreakdownCard byStatus={orderStats} total={orderStats.total} />
        </Grid>
      </Grid>

      <InventoryCard
        recent={stats?.RecentProducts ?? []}
        totalProducts={stats?.TotalProducts ?? 0}
        inventoryValue={stats?.InventoryValue ?? 0}
      />
    </Stack>
  )
}

/* -------- Sub-components -------- */

function Hero({ user, pending }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; pending: number }) {
  const initial = (user.displayName || user.username)[0].toUpperCase()
  return (
    <Paper sx={{
      background: 'linear-gradient(135deg, #0f4c3a 0%, #1a6650 100%)',
      color: '#fff', p: { xs: 3, md: 4 }, borderRadius: 2.5, overflow: 'hidden',
    }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Avatar src={user.avatarPath || undefined} sx={{
          width: 64, height: 64, fontSize: 26, fontWeight: 700,
          bgcolor: '#6fdcb6', color: '#0f4c3a', border: '3px solid rgba(255,255,255,0.2)',
        }}>{initial}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#6fdcb6', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Seller overview
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Welcome back, {user.displayName || user.username}
          </Typography>
          <Typography sx={{ color: '#9bbfb0', fontSize: 14, mt: 0.5 }}>
            {pending === 0
              ? 'All caught up — no orders waiting on you.'
              : `${pending} order${pending === 1 ? '' : 's'} awaiting fulfillment.`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/seller/orders" variant="contained" color="primary"
            startIcon={<ReceiptLongIcon />}>View orders</Button>
          <Button component={RouterLink} to="/seller/products/create" variant="outlined"
            startIcon={<AddIcon />}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>Add product</Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

function StatTile({ label, value, icon, accent, hint }:
  { label: string; value: string | number; icon: React.ReactNode; accent: string; hint?: string }) {
  return (
    <Grid size={{ xs: 6, sm: 4, md: 2 }}>
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: hint ? 0.5 : 0 }}>
            <Avatar sx={{ bgcolor: accent, color: '#fff', width: 40, height: 40 }}>{icon}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
            </Box>
          </Stack>
          {hint && (
            <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>{hint}</Typography>
          )}
        </CardContent>
      </Card>
    </Grid>
  )
}

function RecentOrdersCard({ orders, loading }: { orders: SellerOrder[]; loading: boolean }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <ReceiptLongIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent orders</Typography>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/seller/orders" size="small" endIcon={<ArrowForwardIcon />}>
            View all
          </Button>
        </Stack>
        {loading ? (
          <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>
        ) : orders.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              No orders yet. When a buyer purchases one of your products, it'll show up here.
            </Typography>
            <Button component={RouterLink} to="/seller/products/create" variant="contained">
              Add a product
            </Button>
          </Box>
        ) : (
          <Stack divider={<Divider flexItem />}>
            {orders.map(o => {
              const units = o.items.reduce((s, it) => s + it.qty, 0)
              const firstItem = o.items[0]
              return (
                <Stack key={o.id} direction="row" spacing={2} alignItems="center" sx={{ py: 1.5 }}
                  component={RouterLink} to="/seller/orders"
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Box sx={{
                    width: 44, height: 44, borderRadius: 1, bgcolor: '#f1f5f9',
                    backgroundImage: firstItem?.imagePath ? `url(${firstItem.imagePath})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#cbd5e1', fontWeight: 700,
                  }}>{!firstItem?.imagePath && (firstItem?.name[0]?.toUpperCase() ?? '?')}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
                      {o.ref || `#${o.id}`}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.customerName} · {units} unit{units === 1 ? '' : 's'} · {new Date(o.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip size="small" label={o.status} color={STATUS_COLOR[o.status]} />
                  <Typography sx={{ fontWeight: 700, color: 'success.main', minWidth: 80, textAlign: 'right' }}>
                    ${o.subtotal.toFixed(2)}
                  </Typography>
                </Stack>
              )
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBreakdownCard({ byStatus, total }:
  { byStatus: Record<SellerOrder['status'], number>; total: number }) {
  const segments: { key: SellerOrder['status']; color: string }[] = [
    { key: 'pending',   color: '#ed6c02' },
    { key: 'shipped',   color: '#0288d1' },
    { key: 'delivered', color: '#2e7d32' },
    { key: 'cancelled', color: '#d32f2f' },
  ]
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Order pipeline</Typography>
        {total === 0 ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
            No orders yet — your fulfillment pipeline will appear here.
          </Typography>
        ) : (
          <>
            <Box sx={{
              display: 'flex', height: 10, borderRadius: 1, overflow: 'hidden', mb: 2,
              bgcolor: '#e2e8f0',
            }}>
              {segments.map(s => byStatus[s.key] > 0 && (
                <Box key={s.key} sx={{ flex: byStatus[s.key], bgcolor: s.color }} />
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

function InventoryCard({ recent, totalProducts, inventoryValue }:
  { recent: NonNullable<SellerStats['RecentProducts']>; totalProducts: number; inventoryValue: number }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <Inventory2Icon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Inventory</Typography>
          <Box sx={{ flex: 1 }} />
          <Chip size="small" label={`${totalProducts} product${totalProducts === 1 ? '' : 's'} · $${inventoryValue.toFixed(2)} value`} />
          <Button component={RouterLink} to="/seller/products" size="small" sx={{ ml: 1 }}>
            Manage
          </Button>
        </Stack>
        {recent.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>No products yet.</Typography>
            <Button component={RouterLink} to="/seller/products/create" variant="contained" startIcon={<AddIcon />}>
              Add product
            </Button>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell>Added</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recent.map(p => (
                <TableRow key={p.ID} hover>
                  <TableCell><Typography sx={{ fontWeight: 600 }}>{p.Name}</Typography></TableCell>
                  <TableCell>${p.Price.toFixed(2)}</TableCell>
                  <TableCell>{p.Stock}</TableCell>
                  <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>
                    {new Date(p.CreatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
