import { useEffect, useMemo, useState } from 'react'
import {
  Stack, Typography, Button, Paper, Table,
  TableHead, TableRow, TableCell, TableBody, Skeleton, Chip,
  Box, Tooltip, Avatar, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, InputAdornment, IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  TableSortLabel, Divider, Checkbox, Slide, TablePagination,
} from '@mui/material'
import { useToast } from '../../Toast'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import BoltIcon from '@mui/icons-material/Bolt'
import SearchIcon from '@mui/icons-material/Search'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import { api, type Product } from '../../api'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'
type Status = Product['status']
type SortKey = 'createdAt' | 'name' | 'price' | 'stock'

const STATUS_META: Record<Status, { color: 'warning' | 'success' | 'error'; icon: React.ReactNode; label: string }> = {
  pending: { color: 'warning', icon: <HourglassEmptyOutlinedIcon fontSize="small" />, label: 'Pending' },
  approved: { color: 'success', icon: <CheckCircleOutlineIcon fontSize="small" />, label: 'Approved' },
  rejected: { color: 'error', icon: <HighlightOffOutlinedIcon fontSize="small" />, label: 'Rejected' },
}

const statusChip = (status: Status) => {
  const m = STATUS_META[status]
  return <Chip size="small" color={m.color} icon={m.icon as React.ReactElement} label={m.label}
    sx={{ height: 24, fontWeight: 600, '& .MuiChip-icon': { fontSize: 14 } }} />
}

const defaultEndsAt = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminProducts() {
  const [tab, setTab] = useState<Tab>('pending')
  const [list, setList] = useState<Product[] | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [rejectFor, setRejectFor] = useState<Product | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const toast = useToast()

  // Status menu (per row)
  const [statusAnchor, setStatusAnchor] = useState<{ el: HTMLElement; product: Product } | null>(null)

  // Status-change dialog (for rejected with note input)
  const [statusFor, setStatusFor] = useState<{ product: Product; status: Status } | null>(null)
  const [statusNote, setStatusNote] = useState('')

  // Flash sale dialog
  const [flashFor, setFlashFor] = useState<Product | null>(null)
  const [flashSale, setFlashSale] = useState({ salePrice: '', stock: '', endsAt: defaultEndsAt() })
  const [flashBusy, setFlashBusy] = useState(false)

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkReject, setBulkReject] = useState<{ ids: number[]; names: string[] } | null>(null)
  const [bulkRejectNote, setBulkRejectNote] = useState('')

  // Pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    const stored = Number(localStorage.getItem('admin-products-rpp'))
    return [10, 25, 50, 100].includes(stored) ? stored : 25
  })
  const onRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10)
    setRowsPerPage(v); setPage(0)
    try { localStorage.setItem('admin-products-rpp', String(v)) } catch { /* ignore */ }
  }

  const load = () => {
    setList(null)
    api.adminProducts(tab).then(p => setList(p || [])).catch(console.error)
  }
  useEffect(() => { load() }, [tab])
  useEffect(() => { setSelected(new Set()); setPage(0) }, [tab, query])
  useEffect(() => { setPage(0) }, [sortKey, sortDir])

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, total: 0 }
    list?.forEach(p => { c[p.status]++; c.total++ })
    return c
  }, [list])

  const filtered = useMemo(() => {
    if (!list) return null
    const q = query.trim().toLowerCase()
    let out = q
      ? list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.sellerUsername || '').toLowerCase().includes(q) ||
          (p.categoryName || '').toLowerCase().includes(q) ||
          (p.brandName || '').toLowerCase().includes(q)
        )
      : [...list]
    out.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'price': return (a.price - b.price) * dir
        case 'stock': return (a.stock - b.stock) * dir
        case 'createdAt': default:
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
      }
    })
    return out
  }, [list, query, sortKey, sortDir])

  const sortToggle = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'createdAt' ? 'desc' : 'asc') }
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!paged || paged.length === 0) return
    setSelected(prev =>
      paged.every(p => prev.has(p.id))
        ? new Set([...prev].filter(id => !paged.some(p => p.id === id)))
        : new Set([...prev, ...paged.map(p => p.id)])
    )
  }

  const selectedItems = useMemo(() => filtered?.filter(p => selected.has(p.id)) || [], [filtered, selected])
  const selectedCount = selectedItems.length

  const paged = useMemo(() => {
    if (!filtered) return null
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  // If the current page becomes empty (e.g. last item filtered out), step back.
  useEffect(() => {
    if (filtered && page > 0 && page * rowsPerPage >= filtered.length) {
      setPage(Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1))
    }
  }, [filtered, page, rowsPerPage])

  const bulkApply = async (status: Status, note = '') => {
    if (selectedCount === 0) return
    setBulkBusy(true)
    try {
      const ids = selectedItems.map(p => p.id)
      const res = await api.adminProductBulkStatus(ids, status, note)
      toast.success(`${res.changed} product${res.changed === 1 ? '' : 's'} → ${status}.`)
      setSelected(new Set()); setBulkReject(null); setBulkRejectNote('')
      await load()
    } catch (e) { toast.error(e) } finally { setBulkBusy(false) }
  }

  const onApprove = async (p: Product) => {
    setBusy(p.id)
    try { await api.adminProductApprove(p.id); toast.success(`Approved "${p.name}".`); await load() }
    catch (e) { toast.error(e) } finally { setBusy(null) }
  }

  const submitReject = async () => {
    if (!rejectFor) return
    setBusy(rejectFor.id)
    try {
      await api.adminProductReject(rejectFor.id, rejectNote.trim())
      toast.success(`Rejected "${rejectFor.name}".`)
      setRejectFor(null); setRejectNote(''); await load()
    } catch (e) { toast.error(e) } finally { setBusy(null) }
  }

  const onChangeStatus = (p: Product, next: Status) => {
    setStatusAnchor(null)
    if (next === p.status) return
    if (next === 'rejected') {
      setStatusFor({ product: p, status: next })
      setStatusNote(p.reviewNote || '')
      return
    }
    submitStatus(p, next, '')
  }

  const submitStatus = async (p: Product, status: Status, note: string) => {
    setBusy(p.id)
    try {
      await api.adminProductSetStatus(p.id, status, note)
      toast.success(`"${p.name}" → ${status}.`)
      setStatusFor(null); setStatusNote('')
      await load()
    } catch (e) { toast.error(e) } finally { setBusy(null) }
  }

  const openFlash = (p: Product) => {
    setFlashFor(p)
    const suggested = Math.max(p.price * 0.8, 0).toFixed(2)
    setFlashSale({ salePrice: suggested, stock: String(Math.max(p.stock, 1)), endsAt: defaultEndsAt() })
  }

  const submitFlash = async () => {
    if (!flashFor) return
    const sp = parseFloat(flashSale.salePrice)
    const st = parseInt(flashSale.stock, 10)
    if (!isFinite(sp) || sp < 0) { toast.error('Sale price is invalid.'); return }
    if (sp > flashFor.price) { toast.error('Sale price must be ≤ original price.'); return }
    if (!isFinite(st) || st < 0) { toast.error('Stock is invalid.'); return }
    if (!flashSale.endsAt || new Date(flashSale.endsAt).getTime() <= Date.now()) {
      toast.error('End time must be in the future.'); return
    }
    setFlashBusy(true)
    try {
      await api.adminFlashSaleCreate({
        title: flashFor.name,
        originalPrice: flashFor.price,
        salePrice: sp,
        stock: st,
        endsAt: new Date(flashSale.endsAt).toISOString(),
        productId: flashFor.id,
      })
      toast.success(`"${flashFor.name}" added to flash sales.`)
      setFlashFor(null)
    } catch (e) { toast.error(e) } finally { setFlashBusy(false) }
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
          background: 'radial-gradient(circle at 85% 15%, rgba(56,189,248,0.55), transparent 45%), radial-gradient(circle at 10% 90%, rgba(20,184,166,0.5), transparent 50%)',
        }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          sx={{ position: 'relative', alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 2,
              background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px -8px rgba(14,165,233,0.6)',
            }}>
              <Inventory2OutlinedIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Product approvals
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, mt: 0.5 }}>
                Review, approve, reject — or change a product's status at any time.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatPill label="Pending" value={counts.pending} accent="#fbbf24" />
            <StatPill label="Approved" value={counts.approved} accent="#22c55e" />
            <StatPill label="Rejected" value={counts.rejected} accent="#f87171" />
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
          sx={{ px: 2, py: 1.25, justifyContent: 'space-between', alignItems: { sm: 'center' }, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600 } }}>
            <Tab value="pending" label={`Pending${counts.pending && tab === 'pending' ? ` (${counts.pending})` : ''}`} />
            <Tab value="approved" label="Approved" />
            <Tab value="rejected" label="Rejected" />
            <Tab value="all" label="All" />
          </Tabs>
          <TextField size="small" placeholder="Search SKU, name, seller…" value={query}
            onChange={e => setQuery(e.target.value)} sx={{ minWidth: 240 }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            }} />
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox size="small"
                  disabled={!paged || paged.length === 0}
                  checked={!!paged && paged.length > 0 && paged.every(p => selected.has(p.id))}
                  indeterminate={!!paged && paged.some(p => selected.has(p.id)) && !paged.every(p => selected.has(p.id))}
                  onChange={toggleSelectAll} />
              </TableCell>
              <TableCell></TableCell>
              <TableCell>SKU</TableCell>
              <TableCell sortDirection={sortKey === 'name' ? sortDir : false}>
                <TableSortLabel active={sortKey === 'name'} direction={sortDir} onClick={() => sortToggle('name')}>
                  Product
                </TableSortLabel>
              </TableCell>
              <TableCell>Seller</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell align="right" sortDirection={sortKey === 'price' ? sortDir : false}>
                <TableSortLabel active={sortKey === 'price'} direction={sortDir} onClick={() => sortToggle('price')}>
                  Price
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sortDirection={sortKey === 'stock' ? sortDir : false}>
                <TableSortLabel active={sortKey === 'stock'} direction={sortDir} onClick={() => sortToggle('stock')}>
                  Qty
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Ships</TableCell>
              <TableCell sortDirection={sortKey === 'createdAt' ? sortDir : false}>
                <TableSortLabel active={sortKey === 'createdAt'} direction={sortDir} onClick={() => sortToggle('createdAt')}>
                  Added
                </TableSortLabel>
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!paged ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={13}><Skeleton /></TableCell></TableRow>
            )) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={13}>
                <Stack spacing={1} sx={{ py: 6, color: 'text.secondary', alignItems: 'center' }}>
                  <Inventory2OutlinedIcon sx={{ fontSize: 36, color: 'grey.300' }} />
                  <Typography>{query ? `No products match "${query}".` : 'No products in this view.'}</Typography>
                </Stack>
              </TableCell></TableRow>
            ) : paged.map(p => (
              <TableRow key={p.id} hover selected={selected.has(p.id)}>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                </TableCell>
                <TableCell>
                  {p.imagePath ? (
                    <Avatar variant="rounded" src={p.imagePath} sx={{ width: 40, height: 40 }} />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: 'grey.200', color: 'grey.500' }}>
                      {p.name[0]?.toUpperCase() || '?'}
                    </Avatar>
                  )}
                </TableCell>
                <TableCell><Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.sku}</Box></TableCell>
                <TableCell>
                  <Tooltip title={p.description || ''} placement="top-start">
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{p.name}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ fontSize: 13 }}>@{p.sellerUsername}</TableCell>
                <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{p.categoryName || '—'}</TableCell>
                <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{p.brandName || '—'}</TableCell>
                <TableCell align="right">${p.price.toFixed(2)}</TableCell>
                <TableCell align="right">{p.stock}</TableCell>
                <TableCell align="right" sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {p.shippingDays ? `${p.shippingDays}d` : '—'}
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {new Date(p.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {p.reviewNote
                    ? <Tooltip title={p.reviewNote}><span>{statusChip(p.status)}</span></Tooltip>
                    : statusChip(p.status)}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                    {p.status === 'pending' && (
                      <>
                        <Tooltip title="Approve">
                          <span>
                            <IconButton size="small" disabled={busy === p.id} onClick={() => onApprove(p)}
                              sx={{ color: 'success.main', '&:hover': { bgcolor: 'rgba(34,197,94,0.1)' } }}>
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <span>
                            <IconButton size="small" disabled={busy === p.id}
                              onClick={() => { setRejectFor(p); setRejectNote('') }}
                              sx={{ color: 'error.main', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <Tooltip title="Add to flash sales">
                        <IconButton size="small" onClick={() => openFlash(p)}
                          sx={{ color: '#e11d48', '&:hover': { bgcolor: 'rgba(225,29,72,0.08)' } }}>
                          <BoltIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Change status">
                      <span>
                        <Button size="small" variant="outlined"
                          startIcon={<SwapHorizOutlinedIcon sx={{ fontSize: 16 }} />}
                          endIcon={<MoreHorizIcon sx={{ fontSize: 16 }} />}
                          disabled={busy === p.id}
                          onClick={(e) => setStatusAnchor({ el: e.currentTarget, product: p })}
                          sx={{
                            textTransform: 'none', fontWeight: 600, fontSize: 12, py: 0.25,
                            borderColor: 'divider', color: 'text.secondary',
                            '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'rgba(99,102,241,0.04)' },
                          }}>
                          Status
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered && filtered.length > 0 && (
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={onRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50, 100]}
            showFirstButton showLastButton
            labelRowsPerPage="Rows per page"
            sx={{
              borderTop: 1, borderColor: 'divider',
              '& .MuiTablePagination-toolbar': { minHeight: 48, px: 1.5 },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontSize: 12.5, color: 'text.secondary', fontWeight: 600,
              },
            }}
          />
        )}
      </Paper>

      {/* Status change menu */}
      <Menu
        anchorEl={statusAnchor?.el}
        open={!!statusAnchor}
        onClose={() => setStatusAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: 2 } } }}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Set status
          </Typography>
        </Box>
        <Divider />
        {(['pending', 'approved', 'rejected'] as Status[]).map(s => {
          const meta = STATUS_META[s]
          const active = statusAnchor?.product.status === s
          return (
            <MenuItem key={s} disabled={active}
              onClick={() => statusAnchor && onChangeStatus(statusAnchor.product, s)}
              sx={{ py: 1 }}>
              <ListItemIcon sx={{ color: `${meta.color}.main` }}>{meta.icon}</ListItemIcon>
              <ListItemText primary={meta.label}
                secondary={active ? 'Current status' : undefined}
                slotProps={{
                  primary: { sx: { fontSize: 14, fontWeight: 600 } },
                  secondary: { sx: { fontSize: 11 } },
                }} />
            </MenuItem>
          )
        })}
      </Menu>

      {/* Reject (initial-from-pending) dialog */}
      <Dialog open={!!rejectFor} onClose={() => setRejectFor(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HighlightOffOutlinedIcon color="error" /> Reject "{rejectFor?.name}"
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 14, color: 'text.secondary' }}>
            Add a short note explaining the rejection. The seller will see this on their products page.
          </Typography>
          <TextField fullWidth multiline rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
            placeholder="e.g. Image is unclear, please re-upload at higher resolution." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectFor(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={submitReject} disabled={busy !== null}>
            Reject product
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status change → rejected dialog (any current status) */}
      <Dialog open={!!statusFor} onClose={() => setStatusFor(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SwapHorizOutlinedIcon color="primary" /> Change status to rejected
        </DialogTitle>
        <DialogContent>
          {statusFor && (
            <>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                {statusFor.product.imagePath ? (
                  <Avatar variant="rounded" src={statusFor.product.imagePath} sx={{ width: 44, height: 44 }} />
                ) : (
                  <Avatar variant="rounded" sx={{ width: 44, height: 44, bgcolor: 'grey.200' }}>
                    {statusFor.product.name[0]?.toUpperCase()}
                  </Avatar>
                )}
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{statusFor.product.name}</Typography>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.25 }}>
                    {statusChip(statusFor.product.status)}
                    <SwapHorizOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    {statusChip(statusFor.status)}
                  </Stack>
                </Box>
              </Stack>
              <Typography sx={{ mb: 1, fontSize: 13, color: 'text.secondary' }}>
                Optional note (shown to the seller).
              </Typography>
              <TextField fullWidth multiline rows={3} value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Why is this being moved to rejected?" />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusFor(null)}>Cancel</Button>
          <Button variant="contained" color="error"
            onClick={() => statusFor && submitStatus(statusFor.product, statusFor.status, statusNote.trim())}
            disabled={busy !== null}>
            Move to rejected
          </Button>
        </DialogActions>
      </Dialog>

      {/* Flash sale dialog */}
      <Dialog open={!!flashFor} onClose={() => setFlashFor(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BoltIcon sx={{ color: '#e11d48' }} /> Add to flash sales
        </DialogTitle>
        <DialogContent>
          {flashFor && (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                {flashFor.imagePath ? (
                  <Avatar variant="rounded" src={flashFor.imagePath} sx={{ width: 56, height: 56 }} />
                ) : (
                  <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'grey.200' }}>
                    {flashFor.name[0]?.toUpperCase()}
                  </Avatar>
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>{flashFor.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    Original ${flashFor.price.toFixed(2)} · stock {flashFor.stock}
                  </Typography>
                </Box>
              </Stack>

              <TextField label="Sale price" type="number" size="small"
                slotProps={{
                  htmlInput: { step: '0.01', min: '0' },
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                }}
                value={flashSale.salePrice}
                onChange={e => setFlashSale(s => ({ ...s, salePrice: e.target.value }))}
                helperText={(() => {
                  const sp = parseFloat(flashSale.salePrice)
                  if (!isFinite(sp) || flashFor.price <= 0) return ' '
                  const pct = Math.round(((flashFor.price - sp) / flashFor.price) * 100)
                  return pct > 0 ? `−${pct}% off original` : ' '
                })()} />

              <TextField label="Flash stock" type="number" size="small"
                slotProps={{ htmlInput: { min: '0' } }}
                value={flashSale.stock}
                onChange={e => setFlashSale(s => ({ ...s, stock: e.target.value }))} />

              <TextField label="Ends at" type="datetime-local" size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={flashSale.endsAt}
                onChange={e => setFlashSale(s => ({ ...s, endsAt: e.target.value }))} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFlashFor(null)}>Cancel</Button>
          <Button variant="contained" onClick={submitFlash} disabled={flashBusy}
            sx={{
              textTransform: 'none', fontWeight: 700,
              background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
              '&:hover': { background: 'linear-gradient(135deg, #fb7185, #be123c)' },
            }}>
            {flashBusy ? 'Publishing…' : 'Publish flash deal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk reject dialog */}
      <Dialog open={!!bulkReject} onClose={() => bulkBusy ? null : setBulkReject(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HighlightOffOutlinedIcon color="error" />
          Reject {bulkReject?.ids.length} product{bulkReject?.ids.length === 1 ? '' : 's'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 14, color: 'text.secondary' }}>
            Same note will be saved on every product, visible to each seller.
          </Typography>
          {bulkReject && (
            <Box sx={{
              maxHeight: 120, overflowY: 'auto', mb: 2, p: 1, borderRadius: 1,
              bgcolor: 'rgba(239,68,68,0.04)', border: '1px solid', borderColor: 'rgba(239,68,68,0.15)',
            }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'error.main', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                Selection
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
                {bulkReject.names.join(' · ')}
              </Typography>
            </Box>
          )}
          <TextField fullWidth multiline rows={3} autoFocus value={bulkRejectNote}
            onChange={(e) => setBulkRejectNote(e.target.value)}
            placeholder="e.g. Images are unclear, please re-upload at higher resolution." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkReject(null)} disabled={bulkBusy}>Cancel</Button>
          <Button variant="contained" color="error" disabled={bulkBusy}
            onClick={() => bulkApply('rejected', bulkRejectNote.trim())}>
            {bulkBusy ? 'Rejecting…' : 'Reject all'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating bulk action bar */}
      <Slide direction="up" in={selectedCount > 0} mountOnEnter unmountOnExit>
        <Paper elevation={8} sx={{
          position: 'fixed',
          bottom: { xs: 12, sm: 20 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: (t) => t.zIndex.snackbar,
          px: 2, py: 1.25,
          borderRadius: 99,
          display: 'flex', alignItems: 'center', gap: 1.5,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          boxShadow: '0 18px 48px -16px rgba(15,23,42,0.6)',
          minWidth: { xs: 'calc(100vw - 24px)', sm: 'auto' },
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <Chip size="small" label={`${selectedCount} selected`}
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 12,
              height: 28, '& .MuiChip-label': { px: 1.25 },
            }} />
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.18)', my: 0.5 }} />

          <Tooltip title="Approve selected">
            <span>
              <Button size="small" startIcon={<CheckCircleOutlineIcon />}
                disabled={bulkBusy}
                onClick={() => bulkApply('approved')}
                sx={{
                  textTransform: 'none', fontWeight: 700, color: '#fff',
                  bgcolor: 'rgba(34,197,94,0.15)',
                  '&:hover': { bgcolor: 'rgba(34,197,94,0.3)' },
                }}>
                Approve
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Move selected to pending">
            <span>
              <Button size="small" startIcon={<HourglassEmptyOutlinedIcon />}
                disabled={bulkBusy}
                onClick={() => bulkApply('pending')}
                sx={{
                  textTransform: 'none', fontWeight: 700, color: '#fff',
                  bgcolor: 'rgba(251,191,36,0.15)',
                  '&:hover': { bgcolor: 'rgba(251,191,36,0.3)' },
                }}>
                Pending
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Reject selected (with note)">
            <span>
              <Button size="small" startIcon={<HighlightOffOutlinedIcon />}
                disabled={bulkBusy}
                onClick={() => {
                  setBulkRejectNote('')
                  setBulkReject({
                    ids: selectedItems.map(p => p.id),
                    names: selectedItems.map(p => p.name),
                  })
                }}
                sx={{
                  textTransform: 'none', fontWeight: 700, color: '#fff',
                  bgcolor: 'rgba(239,68,68,0.18)',
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.35)' },
                }}>
                Reject…
              </Button>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.18)', my: 0.5 }} />
          <Tooltip title="Clear selection">
            <IconButton size="small" disabled={bulkBusy} onClick={() => setSelected(new Set())}
              sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>
      </Slide>
    </Stack>
  )
}

function StatPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Box sx={{
      px: 1.75, py: 1, borderRadius: 2,
      bgcolor: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      minWidth: 78, textAlign: 'center',
      backdropFilter: 'blur(6px)',
    }}>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: accent, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  )
}
