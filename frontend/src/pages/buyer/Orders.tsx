import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Button, TextField, MenuItem,
  Divider, Tabs, Tab, Collapse, IconButton, Tooltip,
} from '@mui/material'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import ReplayIcon from '@mui/icons-material/Replay'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { api, type Order, type Product } from '../../api'
import { useCart } from '../../contexts/CartContext'
import { useToast } from '../../components/Toast'

type StatusFilter = 'all' | Order['status']
type Sort = 'newest' | 'oldest' | 'highest' | 'lowest'
type DateRange = 'all' | 'month' | 'quarter' | 'year'

const STATUS_COLOR: Record<Order['status'], 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning', shipped: 'info', delivered: 'success', cancelled: 'error',
}

const STATUS_ICON: Record<Order['status'], React.ReactNode> = {
  pending: <PendingActionsIcon fontSize="small" />,
  shipped: <LocalShippingIcon fontSize="small" />,
  delivered: <CheckCircleIcon fontSize="small" />,
  cancelled: <CancelIcon fontSize="small" />,
}

const PROGRESS_STEPS: { key: Order['status']; label: string }[] = [
  { key: 'pending',   label: 'Placed' },
  { key: 'shipped',   label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
]

export default function BuyerOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [products, setProducts] = useState<Map<number, Product>>(new Map())
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [range, setRange] = useState<DateRange>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.myOrders().then(r => setOrders(r || [])).catch(() => setOrders([]))
    api.products().then(r => {
      const m = new Map<number, Product>()
      for (const p of r || []) m.set(p.id, p)
      setProducts(m)
    }).catch(() => {})
  }, [])

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 }
    for (const o of orders || []) { c.all++; c[o.status]++ }
    return c
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
        if (o.items.some(it => it.name.toLowerCase().includes(term))) return true
        return false
      }
      return true
    })
    list.sort((a, b) => {
      switch (sort) {
        case 'oldest':  return +new Date(a.createdAt) - +new Date(b.createdAt)
        case 'highest': return b.total - a.total
        case 'lowest':  return a.total - b.total
        default:        return +new Date(b.createdAt) - +new Date(a.createdAt)
      }
    })
    return list
  }, [orders, status, sort, range, q])

  if (orders === null) {
    return <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>
  }

  if (orders.length === 0) {
    return <EmptyState title="No orders yet" message="Your purchase history will appear here." />
  }

  return (
    <Stack spacing={3}>
      <Header total={orders.length} />

      <Card>
        <Tabs
          value={status} onChange={(_, v) => setStatus(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab value="all"       label={<TabLabel text="All" count={counts.all} />} />
          <Tab value="pending"   label={<TabLabel text="Pending" count={counts.pending} />} />
          <Tab value="shipped"   label={<TabLabel text="Shipped" count={counts.shipped} />} />
          <Tab value="delivered" label={<TabLabel text="Delivered" count={counts.delivered} />} />
          <Tab value="cancelled" label={<TabLabel text="Cancelled" count={counts.cancelled} />} />
        </Tabs>
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              size="small" placeholder="Search by order ref or item…"
              value={q} onChange={e => setQ(e.target.value)}
              sx={{ flex: 1, minWidth: 240 }}
            />
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
              <MenuItem value="highest">Total: high to low</MenuItem>
              <MenuItem value="lowest">Total: low to high</MenuItem>
            </TextField>
          </Stack>
        </Box>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching orders"
          message="Try a different status, date range, or search term."
        />
      ) : (
        filtered.map(o => <OrderCard key={o.id} order={o} products={products} />)
      )}
    </Stack>
  )
}

/* -------- Sub-components -------- */

function Header({ total }: { total: number }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Your orders</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
        {total} order{total === 1 ? '' : 's'} total
      </Typography>
    </Box>
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

function OrderCard({ order, products }: { order: Order; products: Map<number, Product> }) {
  const [expanded, setExpanded] = useState(false)
  const { add } = useCart()
  const toast = useToast()

  const reorderable = order.items.filter(it => {
    const p = products.get(it.productId)
    return p && p.stock > 0
  })
  const canReorder = reorderable.length > 0 && order.status !== 'pending'

  const handleReorder = () => {
    let added = 0
    let skipped = 0
    for (const it of order.items) {
      const p = products.get(it.productId)
      if (!p || p.stock <= 0) { skipped++; continue }
      add(p, Math.min(it.qty, p.stock))
      added++
    }
    if (added === 0) {
      toast.error('None of these items are available right now.')
    } else if (skipped > 0) {
      toast.success(`Added ${added} item${added === 1 ? '' : 's'} to cart (${skipped} unavailable).`)
    } else {
      toast.success(`Added ${added} item${added === 1 ? '' : 's'} to cart.`)
    }
  }

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(order.ref || `#${order.id}`)
      toast.success('Reference copied.')
    } catch { toast.error('Copy failed.') }
  }

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>Order</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{order.ref || `#${order.id}`}</Typography>
              <Tooltip title="Copy reference"><IconButton size="small" onClick={copyRef}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            </Stack>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {new Date(order.createdAt).toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Chip size="small" variant="outlined" label={order.paymentMethod.toUpperCase()} />
          <Chip size="small" icon={STATUS_ICON[order.status]} label={order.status} color={STATUS_COLOR[order.status]} />
          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>${order.total.toFixed(2)}</Typography>
        </Stack>

        {/* Progress */}
        <Box sx={{ px: 2, pb: 2 }}>
          <ProgressBar status={order.status} />
        </Box>

        <Divider />

        {/* Items */}
        <Stack divider={<Divider />}>
          {(expanded ? order.items : order.items.slice(0, 3)).map(it => (
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
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{it.qty} × ${it.price.toFixed(2)}</Typography>
              </Box>
              <Typography sx={{ fontWeight: 600 }}>${(it.qty * it.price).toFixed(2)}</Typography>
            </Stack>
          ))}
        </Stack>

        {order.items.length > 3 && (
          <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Button size="small" onClick={() => setExpanded(e => !e)}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}>
              {expanded ? 'Show less' : `Show ${order.items.length - 3} more`}
            </Button>
          </Box>
        )}

        {/* Footer: ship-to + totals + actions */}
        <Collapse in collapsedSize={0}>
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#fafbfc' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  Ship to
                </Typography>
                <Typography sx={{ fontSize: 14 }}>{order.customerName} · {order.phone}</Typography>
                <Typography sx={{ fontSize: 14, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{order.address}</Typography>
              </Box>
              <Box sx={{ minWidth: 200 }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  Totals
                </Typography>
                <TotalRow label="Subtotal" value={order.subtotal} />
                <TotalRow label="Shipping" value={order.shippingFee} />
                {order.codFee > 0 && <TotalRow label="COD fee" value={order.codFee} />}
                <Divider sx={{ my: 0.5 }} />
                <TotalRow label="Total" value={order.total} bold />
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
              {canReorder && (
                <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={handleReorder}>
                  Reorder
                </Button>
              )}
              <Button size="small" variant="outlined" component={RouterLink} to="/buyer/addresses">
                Manage addresses
              </Button>
              <Button size="small" variant="contained" component={RouterLink} to="/">
                Keep shopping
              </Button>
            </Stack>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}

function ProgressBar({ status }: { status: Order['status'] }) {
  if (status === 'cancelled') {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{
        p: 1, borderRadius: 1, bgcolor: '#fee2e2', color: '#991b1b',
      }}>
        <CancelIcon fontSize="small" />
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Order cancelled</Typography>
      </Stack>
    )
  }
  const idx = PROGRESS_STEPS.findIndex(s => s.key === status)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {PROGRESS_STEPS.map((s, i) => {
        const reached = i <= idx
        const active = i === idx
        return (
          <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', flex: i < PROGRESS_STEPS.length - 1 ? 1 : 0, minWidth: 0 }}>
            <Stack alignItems="center" spacing={0.5}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: reached ? 'primary.main' : '#e2e8f0',
                color: reached ? '#fff' : '#94a3b8',
                border: active ? '3px solid' : 'none',
                borderColor: active ? 'primary.light' : 'transparent',
              }}>
                {reached ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <Box sx={{ fontSize: 12, fontWeight: 700 }}>{i + 1}</Box>}
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: active ? 700 : 500, color: reached ? 'text.primary' : 'text.secondary' }}>
                {s.label}
              </Typography>
            </Stack>
            {i < PROGRESS_STEPS.length - 1 && (
              <Box sx={{
                flex: 1, height: 2, mx: 1, mb: 2.5,
                bgcolor: i < idx ? 'primary.main' : '#e2e8f0',
              }} />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function TotalRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{
      fontSize: 13, py: 0.25, fontWeight: bold ? 700 : 400,
    }}>
      <Box sx={{ color: bold ? 'text.primary' : 'text.secondary' }}>{label}</Box>
      <Box>${value.toFixed(2)}</Box>
    </Stack>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 6 }}>
        <ReceiptLongOutlinedIcon sx={{ fontSize: 56, color: '#cbd5e1' }} />
        <Typography variant="h6" sx={{ mt: 2, fontWeight: 700 }}>{title}</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>{message}</Typography>
        <Button component={RouterLink} to="/" variant="contained">Browse products</Button>
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
