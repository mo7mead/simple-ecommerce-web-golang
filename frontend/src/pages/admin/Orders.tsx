import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Stack, Card, CardContent, Chip, Select, MenuItem, Box, Grid,
  Table, TableHead, TableBody, TableRow, TableCell, TextField, InputAdornment,
  Paper, ToggleButton, ToggleButtonGroup, LinearProgress, Tooltip, IconButton,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { api, type Order } from '../../api'
import { useToast } from '../../components/Toast'

const STATUSES: Order['status'][] = ['pending', 'shipped', 'delivered', 'cancelled']

const COLOR: Record<Order['status'], 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning', shipped: 'info', delivered: 'success', cancelled: 'error',
}

const STATUS_HEX: Record<Order['status'], string> = {
  pending: '#f59e0b', shipped: '#3b82f6', delivered: '#10b981', cancelled: '#ef4444',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [filter, setFilter] = useState<Order['status'] | 'all'>('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const nav = useNavigate()

  const load = () => {
    setLoading(true)
    api.adminOrders().then(setOrders).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const list = orders || []
    const t = q.trim().toLowerCase()
    return list.filter(o =>
      (filter === 'all' || o.status === filter) &&
      (t === '' ||
        o.ref.toLowerCase().includes(t) ||
        String(o.id).includes(t) ||
        o.customerName.toLowerCase().includes(t) ||
        o.phone.toLowerCase().includes(t) ||
        o.username.toLowerCase().includes(t))
    )
  }, [orders, filter, q])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders?.length ?? 0 }
    STATUSES.forEach(s => { c[s] = (orders || []).filter(o => o.status === s).length })
    return c
  }, [orders])

  const totals = useMemo(() => {
    const active = (orders || []).filter(o => o.status !== 'cancelled')
    const sumActive = active.reduce((s, o) => s + o.total, 0)
    const sumPending = (orders || []).filter(o => o.status === 'pending').reduce((s, o) => s + o.total, 0)
    return { active: sumActive, pending: sumPending, units: active.length }
  }, [orders])

  const setStatus = async (id: number, status: Order['status']) => {
    try {
      await api.adminOrderStatus(id, status)
      toast.success(`#${id} → ${status}`)
      load()
    } catch (e) { toast.error(e) }
  }

  const copyRef = (ref: string) => {
    navigator.clipboard.writeText(ref).then(() => toast.success('Copied'))
  }

  return (
    <Stack spacing={2.5}>
      {/* Hero */}
      <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 3,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #0c4a6e 100%)',
        color: '#fff', p: { xs: 2.5, md: 3.5 },
      }}>
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.22,
          background: 'radial-gradient(circle at 85% 15%, rgba(56,189,248,0.55), transparent 45%), radial-gradient(circle at 10% 90%, rgba(99,102,241,0.5), transparent 50%)',
        }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          sx={{ position: 'relative', alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 2,
              background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px -8px rgba(99,102,241,0.6)',
            }}>
              <ReceiptLongOutlinedIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Orders
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, mt: 0.5 }}>
                Customer orders. Click any row to open the full ticket.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatPill label="Revenue" value={`$${totals.active.toFixed(2)}`} accent="#34d399" mono />
            <StatPill label="Pending $" value={`$${totals.pending.toFixed(2)}`} accent="#fbbf24" mono />
            <StatPill label="Orders" value={String(counts.all)} accent="#fff" />
            <Tooltip title="Refresh">
              <IconButton onClick={load} sx={{ color: '#fff', alignSelf: 'center' }}>
                <RefreshOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Status quick-filter tiles */}
      <Grid container spacing={1.5}>
        {(['all', ...STATUSES] as const).map(s => {
          const isAll = s === 'all'
          const active = filter === s
          const c = isAll ? '#6366f1' : STATUS_HEX[s]
          return (
            <Grid size={{ xs: 6, sm: 'grow' }} key={s}>
              <Card
                onClick={() => setFilter(s as Order['status'] | 'all')}
                sx={{
                  borderRadius: 2, cursor: 'pointer', transition: 'all .15s',
                  border: '2px solid', borderColor: active ? c : 'transparent',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                }}>
                <CardContent sx={{ p: 1.75 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {s}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, mt: 0.25 }}>
                    {counts[s] ?? 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Filter / search bar */}
      <Card sx={{ borderRadius: 2.5 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              placeholder="Search by ref, customer, phone, user…"
              value={q}
              onChange={e => setQ(e.target.value)}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
              }}
              sx={{ flex: 1 }}
            />
            <ToggleButtonGroup
              size="small" exclusive value={filter}
              onChange={(_, v: Order['status'] | 'all' | null) => v && setFilter(v)}
              sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}
            >
              <ToggleButton value="all">All</ToggleButton>
              {STATUSES.map(s => <ToggleButton key={s} value={s}>{s}</ToggleButton>)}
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      {loading && <LinearProgress />}

      <Card sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 700 }}>Ref</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Items</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Pay</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Open</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(o => (
              <TableRow
                key={o.id}
                hover
                onClick={() => nav(`/admin/orders/${encodeURIComponent(o.ref)}`)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(99,102,241,0.04)' } }}
              >
                <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{o.ref || `#${o.id}`}</span>
                    {o.ref && (
                      <Tooltip title="Copy ref">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); copyRef(o.ref) }}
                          sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{o.customerName}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{o.phone} · {o.username}</Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {o.items.reduce((n, it) => n + it.qty, 0)} item(s)
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                  ${o.total.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={o.paymentMethod.toUpperCase()} variant="outlined" />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    size="small"
                    value={o.status}
                    onChange={e => setStatus(o.id, e.target.value as Order['status'])}
                    renderValue={(v) => (
                      <Chip size="small" label={v as string} color={COLOR[v as Order['status']]} />
                    )}
                    sx={{ minWidth: 130 }}
                  >
                    {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {new Date(o.createdAt).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => {
                    e.stopPropagation()
                    nav(`/admin/orders/${encodeURIComponent(o.ref)}`)
                  }}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No orders match the current filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  )
}

function StatPill({ label, value, accent, mono }: { label: string; value: string; accent: string; mono?: boolean }) {
  return (
    <Box sx={{
      px: 1.75, py: 1, borderRadius: 2,
      bgcolor: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      minWidth: 100, textAlign: 'center',
      backdropFilter: 'blur(6px)',
    }}>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 800, color: accent, lineHeight: 1.2,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
      }}>
        {value}
      </Typography>
    </Box>
  )
}
