import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Button, TextField, MenuItem,
  Divider, Tabs, Tab, Grid, Avatar, IconButton, Tooltip,
} from '@mui/material'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PaidIcon from '@mui/icons-material/Paid'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import PersonIcon from '@mui/icons-material/Person'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { api, type SellerOrder } from '../../api'
import { useToast } from '../../components/Toast'

type StatusFilter = 'all' | SellerOrder['status']
type Sort = 'newest' | 'oldest' | 'highest' | 'lowest'
type DateRange = 'all' | 'month' | 'quarter' | 'year'

const STATUS_COLOR: Record<SellerOrder['status'], 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning', shipped: 'info', delivered: 'success', cancelled: 'error',
}

const STATUS_ICON: Record<SellerOrder['status'], React.ReactNode> = {
  pending: <PendingActionsIcon fontSize="small" />,
  shipped: <LocalShippingIcon fontSize="small" />,
  delivered: <CheckCircleIcon fontSize="small" />,
  cancelled: <CancelIcon fontSize="small" />,
}

export default function SellerOrders() {
  const [orders, setOrders] = useState<SellerOrder[] | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [range, setRange] = useState<DateRange>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.sellerOrders().then(r => setOrders(r || [])).catch(() => setOrders([]))
  }, [])

  const stats = useMemo(() => {
    const c = { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 }
    let revenue = 0
    let units = 0
    for (const o of orders || []) {
      c.all++; c[o.status]++
      if (o.status !== 'cancelled') {
        revenue += o.subtotal
        units += o.items.reduce((s, it) => s + it.qty, 0)
      }
    }
    return { ...c, revenue, units }
  }, [orders])

  const filtered = useMemo(() => {
    if (!orders) return []
    const cutoff = rangeCutoff(range)
    const term = q.trim().toLowerCase()
    const list = orders.filter(o => {
      if (status !== 'all' && o.status !== status) return false
      if (cutoff && new Date(o.createdAt) < cutoff) return false
      if (term) {
        if (o.ref.toLowerCase().includes(term)) return true
        if (o.customerName.toLowerCase().includes(term)) return true
        if (o.username.toLowerCase().includes(term)) return true
        if (o.items.some(it => it.name.toLowerCase().includes(term))) return true
        return false
      }
      return true
    })
    list.sort((a, b) => {
      switch (sort) {
        case 'oldest':  return +new Date(a.createdAt) - +new Date(b.createdAt)
        case 'highest': return b.subtotal - a.subtotal
        case 'lowest':  return a.subtotal - b.subtotal
        default:        return +new Date(b.createdAt) - +new Date(a.createdAt)
      }
    })
    return list
  }, [orders, status, sort, range, q])

  if (orders === null) {
    return <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>
  }

  if (orders.length === 0) {
    return <EmptyState
      title="No orders yet"
      message="Once a buyer purchases one of your products, you'll see it here."
    />
  }

  return (
    <Stack spacing={3}>
      <Header total={orders.length} pending={stats.pending} />

      <Grid container spacing={2}>
        <StatTile label="Orders to fulfill" value={stats.pending + stats.shipped}
          icon={<PendingActionsIcon />} accent="#ed6c02" />
        <StatTile label="Revenue (your items)" value={`$${stats.revenue.toFixed(2)}`}
          icon={<PaidIcon />} accent="#2e7d32" />
        <StatTile label="Units sold" value={stats.units} icon={<Inventory2Icon />} accent="#0288d1" />
        <StatTile label="Delivered" value={stats.delivered} icon={<CheckCircleIcon />} accent="#1a6650" />
      </Grid>

      <Card>
        <Tabs value={status} onChange={(_, v) => setStatus(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab value="all"       label={<TabLabel text="All"       count={stats.all} />} />
          <Tab value="pending"   label={<TabLabel text="Pending"   count={stats.pending} />} />
          <Tab value="shipped"   label={<TabLabel text="Shipped"   count={stats.shipped} />} />
          <Tab value="delivered" label={<TabLabel text="Delivered" count={stats.delivered} />} />
          <Tab value="cancelled" label={<TabLabel text="Cancelled" count={stats.cancelled} />} />
        </Tabs>
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField size="small" placeholder="Search ref, customer, or item…"
              value={q} onChange={e => setQ(e.target.value)}
              sx={{ flex: 1, minWidth: 240 }} />
            <TextField select size="small" label="Date" value={range}
              onChange={e => setRange(e.target.value as DateRange)} sx={{ minWidth: 160 }}>
              <MenuItem value="all">All time</MenuItem>
              <MenuItem value="month">Last 30 days</MenuItem>
              <MenuItem value="quarter">Last 3 months</MenuItem>
              <MenuItem value="year">Last year</MenuItem>
            </TextField>
            <TextField select size="small" label="Sort" value={sort}
              onChange={e => setSort(e.target.value as Sort)} sx={{ minWidth: 180 }}>
              <MenuItem value="newest">Newest first</MenuItem>
              <MenuItem value="oldest">Oldest first</MenuItem>
              <MenuItem value="highest">Revenue: high to low</MenuItem>
              <MenuItem value="lowest">Revenue: low to high</MenuItem>
            </TextField>
          </Stack>
        </Box>
      </Card>

      {filtered.length === 0 ? (
        <Card><CardContent>
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
            No matching orders.
          </Typography>
        </CardContent></Card>
      ) : (
        filtered.map(o => <SellerOrderCard key={o.id} order={o} />)
      )}
    </Stack>
  )
}

/* -------- Sub-components -------- */

function Header({ total, pending }: { total: number; pending: number }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Your orders</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
        {total} order{total === 1 ? '' : 's'} containing your products
        {pending > 0 && ` · ${pending} awaiting fulfillment`}.
      </Typography>
    </Box>
  )
}

function StatTile({ label, value, icon, accent }:
  { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <Grid size={{ xs: 6, sm: 3 }}>
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

function TabLabel({ text, count }: { text: string; count: number }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box>{text}</Box>
      <Chip size="small" label={count} sx={{ height: 20, fontSize: 11 }} />
    </Stack>
  )
}

function SellerOrderCard({ order: o }: { order: SellerOrder }) {
  const toast = useToast()
  const units = o.items.reduce((s, it) => s + it.qty, 0)

  const copyRef = async () => {
    try { await navigator.clipboard.writeText(o.ref || `#${o.id}`); toast.success('Reference copied.') }
    catch { toast.error('Copy failed.') }
  }

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Order</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.ref || `#${o.id}`}</Typography>
              <Tooltip title="Copy reference"><IconButton size="small" onClick={copyRef}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            </Stack>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {new Date(o.createdAt).toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Chip size="small" variant="outlined" label={o.paymentMethod.toUpperCase()} />
          <Chip size="small" icon={STATUS_ICON[o.status]} label={o.status} color={STATUS_COLOR[o.status]} />
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Your revenue
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'success.main' }}>
              ${o.subtotal.toFixed(2)}
            </Typography>
          </Box>
        </Stack>

        <Divider />

        {/* Items to fulfill */}
        <Box sx={{ px: 2, py: 1, bgcolor: '#f8fafc', borderBottom: 1, borderColor: 'divider' }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Items to fulfill · {units} unit{units === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Stack divider={<Divider />}>
          {o.items.map(it => (
            <Stack key={it.productId} direction="row" alignItems="center" spacing={2} sx={{ p: 2 }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: 1, bgcolor: '#f1f5f9',
                backgroundImage: it.imagePath ? `url(${it.imagePath})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#cbd5e1', fontWeight: 700,
              }}>{!it.imagePath && (it.name[0]?.toUpperCase() ?? '?')}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{it.name}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  Qty {it.qty} · ${it.price.toFixed(2)} each
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 700 }}>${(it.qty * it.price).toFixed(2)}</Typography>
            </Stack>
          ))}
        </Stack>

        {/* Customer + ship-to */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#fafbfc' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                Customer
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{o.customerName}</Typography>
                {o.username && (
                  <Chip size="small" label={`@${o.username}`} variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                )}
              </Stack>
              <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{o.phone}</Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                Ship to
              </Typography>
              <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{o.address}</Typography>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 6 }}>
        <ReceiptLongOutlinedIcon sx={{ fontSize: 56, color: '#cbd5e1' }} />
        <Typography variant="h6" sx={{ mt: 2, fontWeight: 700 }}>{title}</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>{message}</Typography>
        <Button component={RouterLink} to="/seller/products/create" variant="contained">
          Add a product
        </Button>
      </CardContent>
    </Card>
  )
}

/* -------- Helpers -------- */

function rangeCutoff(range: DateRange): Date | null {
  if (range === 'all') return null
  const d = new Date()
  switch (range) {
    case 'month':   d.setDate(d.getDate() - 30); break
    case 'quarter': d.setMonth(d.getMonth() - 3); break
    case 'year':    d.setFullYear(d.getFullYear() - 1); break
  }
  return d
}
