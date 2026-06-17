import { useEffect, useState } from 'react'
import {
  Stack, Typography, Button, Paper, Table,
  TableHead, TableRow, TableCell, TableBody, IconButton, Skeleton, Chip,
  Box, Tooltip, Avatar,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { Link as RouterLink } from 'react-router-dom'
import { api, type Product } from '../../api'

const statusChip = (status: Product['status'], note: string) => {
  const map: Record<Product['status'], { color: 'warning' | 'success' | 'error'; label: string }> = {
    pending: { color: 'warning', label: 'Pending review' },
    approved: { color: 'success', label: 'Approved' },
    rejected: { color: 'error', label: 'Rejected' },
  }
  const m = map[status]
  const chip = <Chip size="small" color={m.color} label={m.label} />
  return note ? <Tooltip title={note}><span>{chip}</span></Tooltip> : chip
}

export default function SellerProducts() {
  const [list, setList] = useState<Product[] | null>(null)
  const load = () => api.sellerProducts().then(p => setList(p || [])).catch(console.error)
  useEffect(() => { load() }, [])

  const onDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return
    await api.sellerProductDelete(id); await load()
  }

  const counts = (list || []).reduce(
    (acc, p) => ({ ...acc, [p.status]: (acc[p.status] || 0) + 1 }),
    {} as Record<string, number>,
  )

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Products</Typography>
          {counts.pending > 0 && <Chip size="small" color="warning" label={`${counts.pending} pending`} />}
          {counts.rejected > 0 && <Chip size="small" color="error" label={`${counts.rejected} rejected`} />}
        </Stack>
        <Button component={RouterLink} to="/seller/products/create" variant="contained" startIcon={<AddIcon />}>
          New product
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Ships</TableCell>
              <TableCell>Status</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!list ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={10}><Skeleton /></TableCell></TableRow>
            )) : list.length === 0 ? (
              <TableRow><TableCell colSpan={10}>
                <Stack spacing={1.5} sx={{ alignItems: 'center', py: 4 }}>
                  <Typography color="text.secondary">No products yet.</Typography>
                  <Button component={RouterLink} to="/seller/products/create" variant="contained" startIcon={<AddIcon />}>
                    Create your first
                  </Button>
                </Stack>
              </TableCell></TableRow>
            ) : list.map(p => (
              <TableRow key={p.id} hover>
                <TableCell>
                  {p.imagePath ? (
                    <Avatar variant="rounded" src={p.imagePath} sx={{ width: 36, height: 36 }} />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'grey.200', color: 'grey.500' }}>
                      {p.name[0]?.toUpperCase() || '?'}
                    </Avatar>
                  )}
                </TableCell>
                <TableCell><Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.sku}</Box></TableCell>
                <TableCell><Typography sx={{ fontWeight: 600, fontSize: 14 }}>{p.name}</Typography></TableCell>
                <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{p.categoryName || '—'}</TableCell>
                <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{p.brandName || '—'}</TableCell>
                <TableCell align="right">${p.price.toFixed(2)}</TableCell>
                <TableCell align="right">{p.stock}</TableCell>
                <TableCell align="right" sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {p.shippingDays ? `${p.shippingDays}d` : '—'}
                </TableCell>
                <TableCell>{statusChip(p.status, p.reviewNote)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => onDelete(p.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  )
}
