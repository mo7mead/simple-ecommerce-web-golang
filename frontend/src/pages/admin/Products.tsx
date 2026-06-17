import { useEffect, useState } from 'react'
import {
  Stack, Typography, Button, Paper, Table,
  TableHead, TableRow, TableCell, TableBody, Skeleton, Chip,
  Box, Tooltip, Avatar, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { api, type Product } from '../../api'

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

const statusChip = (status: Product['status']) => {
  const map: Record<Product['status'], { color: 'warning' | 'success' | 'error' }> = {
    pending: { color: 'warning' }, approved: { color: 'success' }, rejected: { color: 'error' },
  }
  return <Chip size="small" color={map[status].color} label={status} />
}

export default function AdminProducts() {
  const [tab, setTab] = useState<Tab>('pending')
  const [list, setList] = useState<Product[] | null>(null)
  const [rejectFor, setRejectFor] = useState<Product | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setList(null)
    api.adminProducts(tab).then(p => setList(p || [])).catch(console.error)
  }
  useEffect(() => { load() }, [tab])

  const onApprove = async (p: Product) => {
    setBusy(p.id); setErr(null)
    try { await api.adminProductApprove(p.id); await load() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  const submitReject = async () => {
    if (!rejectFor) return
    setBusy(rejectFor.id); setErr(null)
    try {
      await api.adminProductReject(rejectFor.id, rejectNote.trim())
      setRejectFor(null); setRejectNote(''); await load()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  const pendingCount = list?.filter(p => p.status === 'pending').length ?? 0

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Product approvals</Typography>
        {tab === 'pending' && pendingCount > 0 && (
          <Chip size="small" color="warning" label={`${pendingCount} pending`} />
        )}
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="pending" label="Pending" />
          <Tab value="approved" label="Approved" />
          <Tab value="rejected" label="Rejected" />
          <Tab value="all" label="All" />
        </Tabs>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Seller</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Ships</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!list ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={11}><Skeleton /></TableCell></TableRow>
            )) : list.length === 0 ? (
              <TableRow><TableCell colSpan={11}>
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  No products in this view.
                </Typography>
              </TableCell></TableRow>
            ) : list.map(p => (
              <TableRow key={p.id} hover>
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
                <TableCell>
                  {p.reviewNote ? (
                    <Tooltip title={p.reviewNote}><span>{statusChip(p.status)}</span></Tooltip>
                  ) : statusChip(p.status)}
                </TableCell>
                <TableCell align="right">
                  {p.status === 'pending' ? (
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                      <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />}
                        disabled={busy === p.id} onClick={() => onApprove(p)}>Approve</Button>
                      <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />}
                        disabled={busy === p.id} onClick={() => { setRejectFor(p); setRejectNote('') }}>
                        Reject
                      </Button>
                    </Stack>
                  ) : (
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!rejectFor} onClose={() => setRejectFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reject "{rejectFor?.name}"</DialogTitle>
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
    </Stack>
  )
}
