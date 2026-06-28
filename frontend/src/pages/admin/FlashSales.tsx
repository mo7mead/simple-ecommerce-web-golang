import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid, IconButton,
  Skeleton, Chip, Tabs, Tab, Autocomplete, Avatar, ToggleButton,
  ToggleButtonGroup, LinearProgress, Tooltip, Divider, InputAdornment, Paper,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material'
import { useToast } from '../../components/Toast'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import BoltIcon from '@mui/icons-material/Bolt'
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import { api, type FlashSale, type Product } from '../../api'

type Mode = 'custom' | 'product'
type FilterTab = 'live' | 'expired' | 'all'
type View = 'grid' | 'list'

const defaultEndsAt = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fmtTimeLeft = (ms: number) => {
  if (ms <= 0) return 'Expired'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export default function AdminFlashSales() {
  const [items, setItems] = useState<FlashSale[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [mode, setMode] = useState<Mode>('custom')
  const [product, setProduct] = useState<Product | null>(null)
  const [title, setTitle] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [stock, setStock] = useState('100')
  const [endsAt, setEndsAt] = useState(defaultEndsAt())
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()
  const [tab, setTab] = useState<FilterTab>('live')
  const [view, setView] = useState<View>('grid')
  const [now, setNow] = useState(Date.now())
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => api.adminFlashSales().then(s => setItems(s || [])).catch(console.error)
  useEffect(() => { load() }, [])
  useEffect(() => {
    api.adminProducts('approved').then(p => setProducts(p || [])).catch(console.error)
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const resetForm = () => {
    setTitle(''); setOriginalPrice(''); setSalePrice(''); setStock('100')
    setEndsAt(defaultEndsAt()); setFile(null); setProduct(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onPickProduct = (p: Product | null) => {
    setProduct(p)
    if (p) {
      if (!title.trim()) setTitle(p.name)
      if (!originalPrice) setOriginalPrice(String(p.price))
      if (stock === '100' || stock === '') setStock(String(Math.max(p.stock, 0)))
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const op = parseFloat(originalPrice)
    const sp = parseFloat(salePrice)
    const st = parseInt(stock, 10)
    if (mode === 'product' && !product) { toast.error('Pick a product.'); return }
    if (mode === 'custom' && !title.trim()) { toast.error('Title is required.'); return }
    if (mode === 'custom' && !file) { toast.error('Image is required for a custom deal.'); return }
    if (!isFinite(op) || op < 0) { toast.error('Original price is invalid.'); return }
    if (!isFinite(sp) || sp < 0) { toast.error('Sale price is invalid.'); return }
    if (sp > op) { toast.error('Sale price must be ≤ original price.'); return }
    if (!isFinite(st) || st < 0) { toast.error('Stock is invalid.'); return }
    if (!endsAt) { toast.error('End time is required.'); return }
    if (new Date(endsAt).getTime() <= Date.now()) { toast.error('End time must be in the future.'); return }

    setUploading(true)
    try {
      await api.adminFlashSaleCreate({
        title: title.trim(), originalPrice: op, salePrice: sp,
        stock: st, endsAt: new Date(endsAt).toISOString(),
        image: file || undefined,
        productId: mode === 'product' && product ? product.id : null,
      })
      toast.success('Flash deal published.')
      resetForm()
      await load()
    } catch (e) { toast.error(e) } finally { setUploading(false) }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this flash sale?')) return
    try {
      await api.adminFlashSaleDelete(id)
      toast.success('Flash deal deleted.')
      await load()
    } catch (e) { toast.error(e) }
  }

  const counts = useMemo(() => {
    const live = items?.filter(f => new Date(f.endsAt).getTime() > now).length ?? 0
    const expired = items?.filter(f => new Date(f.endsAt).getTime() <= now).length ?? 0
    return { live, expired, total: items?.length ?? 0 }
  }, [items, now])

  const filtered = useMemo(() => {
    if (!items) return null
    if (tab === 'live') return items.filter(f => new Date(f.endsAt).getTime() > now)
    if (tab === 'expired') return items.filter(f => new Date(f.endsAt).getTime() <= now)
    return items
  }, [items, tab, now])

  const op = parseFloat(originalPrice)
  const sp = parseFloat(salePrice)
  const previewPct = isFinite(op) && isFinite(sp) && op > 0 && sp <= op
    ? Math.round(((op - sp) / op) * 100) : 0

  return (
    <Stack spacing={2.5}>
      {/* Hero header */}
      <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 3,
        background: 'linear-gradient(135deg, #1a0b1f 0%, #3d0f2e 45%, #4a0e1f 100%)',
        color: '#fff', p: { xs: 2.5, md: 3.5 },
      }}>
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.18,
          background: 'radial-gradient(circle at 80% 20%, rgba(255,193,7,0.55), transparent 45%), radial-gradient(circle at 10% 80%, rgba(244,63,94,0.45), transparent 50%)',
        }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ position: 'relative', alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 2,
              background: 'linear-gradient(135deg, #fbbf24, #ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px -8px rgba(239,68,68,0.6)',
            }}>
              <BoltIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Flash sales
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, mt: 0.5 }}>
                Time-boxed promos with limited stock. Pick an approved product or craft a custom deal.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatPill label="Live" value={counts.live} accent="#22c55e" />
            <StatPill label="Expired" value={counts.expired} accent="#94a3b8" />
            <StatPill label="Total" value={counts.total} accent="#fff" />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {/* Create form */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ position: 'sticky', top: 0, borderRadius: 2.5, overflow: 'visible' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <LocalOfferOutlinedIcon sx={{ color: '#e11d48' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>New flash deal</Typography>
              </Stack>

              <ToggleButtonGroup
                value={mode} exclusive size="small" fullWidth color="primary"
                onChange={(_, v: Mode | null) => v && setMode(v)} sx={{ mb: 2 }}
              >
                <ToggleButton value="custom" sx={{ textTransform: 'none', fontWeight: 600 }}>
                  <EditOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} /> Custom
                </ToggleButton>
                <ToggleButton value="product" sx={{ textTransform: 'none', fontWeight: 600 }}>
                  <Inventory2OutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} /> From product
                </ToggleButton>
              </ToggleButtonGroup>

              <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                  {mode === 'product' && (
                    <Autocomplete
                      size="small"
                      options={products}
                      value={product}
                      onChange={(_, v) => onPickProduct(v)}
                      getOptionLabel={(p) => `${p.name} · @${p.sellerUsername}`}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      noOptionsText="No approved products yet"
                      renderOption={(props, p) => {
                        const { key, ...rest } = props as { key: React.Key } & React.HTMLAttributes<HTMLLIElement>
                        return (
                          <Box component="li" key={key} {...rest} sx={{ gap: 1.25 }}>
                            <Avatar src={p.imagePath || undefined} variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'grey.200', color: 'grey.600', fontSize: 14 }}>
                              {p.name[0]?.toUpperCase() || '?'}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>{p.name}</Typography>
                              <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
                                ${p.price.toFixed(2)} · stock {p.stock} · @{p.sellerUsername}
                              </Typography>
                            </Box>
                          </Box>
                        )
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="Approved product" required placeholder="Search products…" />
                      )}
                    />
                  )}

                  <TextField
                    label={mode === 'product' ? 'Display title (defaults to product name)' : 'Title'}
                    value={title} onChange={e => setTitle(e.target.value)}
                    required={mode === 'custom'} fullWidth size="small"
                  />

                  <Stack direction="row" spacing={1}>
                    <TextField label="Original" type="number" size="small"
                      slotProps={{
                        htmlInput: { step: '0.01', min: '0' },
                        input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                      }}
                      value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} required fullWidth />
                    <TextField label="Sale" type="number" size="small"
                      slotProps={{
                        htmlInput: { step: '0.01', min: '0' },
                        input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                      }}
                      value={salePrice} onChange={e => setSalePrice(e.target.value)} required fullWidth />
                  </Stack>

                  {previewPct > 0 && (
                    <Box sx={{
                      px: 1.5, py: 1, borderRadius: 1.5,
                      bgcolor: 'rgba(225,29,72,0.08)', border: '1px dashed rgba(225,29,72,0.3)',
                      display: 'flex', alignItems: 'center', gap: 1,
                    }}>
                      <BoltIcon sx={{ color: '#e11d48', fontSize: 18 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#9f1239' }}>
                        −{previewPct}% off · save ${(op - sp).toFixed(2)} per unit
                      </Typography>
                    </Box>
                  )}

                  <Stack direction="row" spacing={1}>
                    <TextField label="Stock" type="number" size="small"
                      slotProps={{ htmlInput: { min: '0' } }}
                      value={stock} onChange={e => setStock(e.target.value)} fullWidth />
                    <TextField label="Ends at" type="datetime-local" size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={endsAt} onChange={e => setEndsAt(e.target.value)} required fullWidth />
                  </Stack>

                  <Button component="label" variant="outlined" size="small" startIcon={<CloudUploadIcon />} sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
                    {file ? file.name : (mode === 'product' && product?.imagePath ? 'Use product image (or upload to override)' : 'Choose image')}
                    <input ref={fileRef} hidden type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </Button>

                  <Button type="submit" variant="contained" size="large" disabled={uploading}
                    sx={{
                      textTransform: 'none', fontWeight: 700, py: 1.1,
                      background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                      '&:hover': { background: 'linear-gradient(135deg, #fb7185, #be123c)' },
                    }}>
                    {uploading ? 'Publishing…' : 'Publish flash deal'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* List */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}
              sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600 } }}>
              <Tab value="live" label={`Live (${counts.live})`} />
              <Tab value="expired" label={`Expired (${counts.expired})`} />
              <Tab value="all" label={`All (${counts.total})`} />
            </Tabs>
            <ToggleButtonGroup value={view} exclusive size="small"
              onChange={(_, v: View | null) => v && setView(v)}>
              <ToggleButton value="grid"><GridViewRoundedIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="list"><ViewListRoundedIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {!filtered ? (
            <Grid container spacing={2}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Grid size={{ xs: 12, sm: 6 }} key={i}><Skeleton variant="rounded" height={260} /></Grid>
              ))}
            </Grid>
          ) : filtered.length === 0 ? (
            <Card variant="outlined" sx={{ borderStyle: 'dashed' }}>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <BoltIcon sx={{ fontSize: 40, color: 'grey.300', mb: 1 }} />
                <Typography color="text.secondary">
                  {tab === 'live' ? 'No live flash deals — publish one to set things on fire.'
                    : tab === 'expired' ? 'No expired deals yet.'
                    : 'No flash deals yet — create your first.'}
                </Typography>
              </CardContent>
            </Card>
          ) : view === 'list' ? (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Sale</TableCell>
                    <TableCell align="right">Original</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>Sold</TableCell>
                    <TableCell>Ends</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(f => {
                    const endsMs = new Date(f.endsAt).getTime()
                    const expired = endsMs <= now
                    const pct = f.originalPrice > 0
                      ? Math.round(((f.originalPrice - f.salePrice) / f.originalPrice) * 100) : 0
                    const totalStock = f.stock + f.sold
                    const soldPct = totalStock > 0 ? Math.round((f.sold / totalStock) * 100) : 0
                    return (
                      <TableRow key={f.id} hover>
                        <TableCell sx={{ width: 56 }}>
                          <Avatar variant="rounded" src={f.imagePath} sx={{
                            width: 44, height: 44, filter: expired ? 'grayscale(0.7)' : 'none',
                          }} />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{f.title}</Typography>
                          {f.productId && (
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.25 }}>
                              <Inventory2OutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                              <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace' }}>
                                {f.productSku}
                              </Typography>
                            </Stack>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {pct > 0 ? (
                            <Chip size="small" label={`−${pct}%`}
                              sx={{
                                height: 22, fontWeight: 700, fontSize: 11,
                                color: '#fff',
                                background: expired ? 'rgba(100,116,139,0.95)' : 'linear-gradient(135deg,#f43f5e,#e11d48)',
                              }} />
                          ) : <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#e11d48' }}>
                          ${f.salePrice.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', textDecoration: 'line-through', fontSize: 13 }}>
                          ${f.originalPrice.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                              {f.sold} / {totalStock}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>{soldPct}%</Typography>
                          </Stack>
                          <LinearProgress variant="determinate" value={Math.min(soldPct, 100)}
                            sx={{
                              height: 5, borderRadius: 3, mt: 0.25, bgcolor: 'grey.100',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                              },
                            }} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <AccessTimeOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                              {new Date(f.endsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip size="small"
                            icon={<TimerOutlinedIcon sx={{ fontSize: 13 }} />}
                            label={fmtTimeLeft(endsMs - now)}
                            sx={{
                              height: 22, fontSize: 11, fontWeight: 700,
                              color: '#fff',
                              bgcolor: expired ? 'rgba(100,116,139,0.9)' : 'rgba(34,197,94,0.92)',
                              '& .MuiChip-icon': { color: '#fff' },
                            }} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => onDelete(f.id)}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'rgba(239,68,68,0.08)' } }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {filtered.map(f => {
                const endsMs = new Date(f.endsAt).getTime()
                const expired = endsMs <= now
                const pct = f.originalPrice > 0
                  ? Math.round(((f.originalPrice - f.salePrice) / f.originalPrice) * 100) : 0
                const totalStock = f.stock + f.sold
                const soldPct = totalStock > 0 ? Math.round((f.sold / totalStock) * 100) : 0
                return (
                  <Grid size={{ xs: 12, sm: 6 }} key={f.id}>
                    <Card sx={{
                      position: 'relative', overflow: 'hidden', borderRadius: 2.5,
                      transition: 'transform .2s, box-shadow .2s',
                      '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                    }}>
                      <Box sx={{ position: 'relative' }}>
                        <Box sx={{
                          aspectRatio: '16/9',
                          backgroundImage: `url(${f.imagePath})`,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          filter: expired ? 'grayscale(0.7) brightness(0.85)' : 'none',
                        }} />
                        <Box sx={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)',
                        }} />

                        {pct > 0 && (
                          <Box sx={{
                            position: 'absolute', top: 10, left: 10,
                            background: expired ? 'rgba(100,116,139,0.95)' : 'linear-gradient(135deg, #f43f5e, #e11d48)',
                            color: '#fff', fontSize: 13, fontWeight: 800,
                            px: 1.25, py: 0.5, borderRadius: 1.25,
                            boxShadow: '0 4px 12px -4px rgba(225,29,72,0.5)',
                          }}>
                            −{pct}%
                          </Box>
                        )}

                        <Tooltip title="Delete">
                          <IconButton size="small" sx={{
                            position: 'absolute', top: 10, right: 10,
                            bgcolor: 'rgba(15,23,42,0.6)', color: '#fff', backdropFilter: 'blur(6px)',
                            '&:hover': { bgcolor: 'error.main' },
                          }} onClick={() => onDelete(f.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {f.productId && (
                          <Chip
                            size="small"
                            icon={<Inventory2OutlinedIcon sx={{ fontSize: 14 }} />}
                            label={f.productSku || 'Linked'}
                            sx={{
                              position: 'absolute', bottom: 10, left: 10,
                              bgcolor: 'rgba(15,23,42,0.7)', color: '#fff', backdropFilter: 'blur(6px)',
                              fontWeight: 600, fontSize: 11, height: 22,
                              '& .MuiChip-icon': { color: '#fff' },
                            }}
                          />
                        )}

                        <Chip
                          size="small"
                          icon={<TimerOutlinedIcon sx={{ fontSize: 14 }} />}
                          label={fmtTimeLeft(endsMs - now)}
                          sx={{
                            position: 'absolute', bottom: 10, right: 10,
                            bgcolor: expired ? 'rgba(100,116,139,0.85)' : 'rgba(34,197,94,0.92)',
                            color: '#fff', fontWeight: 700, fontSize: 11, height: 22,
                            '& .MuiChip-icon': { color: '#fff' },
                          }}
                        />
                      </Box>

                      <CardContent sx={{ p: 2 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, mb: 0.5 }} noWrap>
                          {f.title}
                        </Typography>

                        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1.25 }}>
                          <Typography sx={{ color: '#e11d48', fontWeight: 800, fontSize: 20 }}>
                            ${f.salePrice.toFixed(2)}
                          </Typography>
                          {f.originalPrice > f.salePrice && (
                            <Typography sx={{ color: 'text.secondary', textDecoration: 'line-through', fontSize: 13 }}>
                              ${f.originalPrice.toFixed(2)}
                            </Typography>
                          )}
                        </Stack>

                        <Box sx={{ mb: 1 }}>
                          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                              Sold {f.sold} / {totalStock}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                              {soldPct}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate" value={Math.min(soldPct, 100)}
                            sx={{
                              height: 6, borderRadius: 3, bgcolor: 'grey.100',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                              },
                            }}
                          />
                        </Box>

                        <Divider sx={{ my: 1 }} />
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <AccessTimeOutlinedIcon sx={{ fontSize: 14 }} />
                          <Typography sx={{ fontSize: 11 }}>
                            Ends {new Date(f.endsAt).toLocaleString()}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </Grid>
      </Grid>
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
