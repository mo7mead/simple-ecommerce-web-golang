import { useEffect, useRef, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid, IconButton,
  Alert, Skeleton, Chip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import BoltIcon from '@mui/icons-material/Bolt'
import { api, type FlashSale } from '../../api'

const defaultEndsAt = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminFlashSales() {
  const [items, setItems] = useState<FlashSale[] | null>(null)
  const [title, setTitle] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [stock, setStock] = useState('100')
  const [endsAt, setEndsAt] = useState(defaultEndsAt())
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => api.adminFlashSales().then(s => setItems(s || [])).catch(console.error)
  useEffect(() => { load() }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    const op = parseFloat(originalPrice)
    const sp = parseFloat(salePrice)
    const st = parseInt(stock, 10)
    if (!title.trim() || !file) { setErr('Title and image are required.'); return }
    if (!isFinite(op) || op < 0) { setErr('Original price is invalid.'); return }
    if (!isFinite(sp) || sp < 0) { setErr('Sale price is invalid.'); return }
    if (sp > op) { setErr('Sale price must be ≤ original price.'); return }
    if (!isFinite(st) || st < 0) { setErr('Stock is invalid.'); return }
    if (!endsAt) { setErr('End time is required.'); return }
    if (new Date(endsAt).getTime() <= Date.now()) { setErr('End time must be in the future.'); return }

    setUploading(true)
    try {
      await api.adminFlashSaleCreate({
        title: title.trim(), originalPrice: op, salePrice: sp,
        stock: st, endsAt: new Date(endsAt).toISOString(), image: file,
      })
      setTitle(''); setOriginalPrice(''); setSalePrice(''); setStock('100')
      setEndsAt(defaultEndsAt()); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (e) { setErr((e as Error).message) } finally { setUploading(false) }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this flash sale?')) return
    await api.adminFlashSaleDelete(id); await load()
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <BoltIcon sx={{ color: '#e11d48' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Flash sales</Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ position: 'sticky', top: 0 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>New flash deal</Typography>
              <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                  {err && <Alert severity="error">{err}</Alert>}
                  <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} required fullWidth />
                  <Stack direction="row" spacing={1}>
                    <TextField label="Original price" type="number"
                      slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
                      value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} required fullWidth />
                    <TextField label="Sale price" type="number"
                      slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
                      value={salePrice} onChange={e => setSalePrice(e.target.value)} required fullWidth />
                  </Stack>
                  <TextField label="Stock" type="number"
                    slotProps={{ htmlInput: { min: '0' } }}
                    value={stock} onChange={e => setStock(e.target.value)} fullWidth />
                  <TextField label="Ends at" type="datetime-local"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={endsAt} onChange={e => setEndsAt(e.target.value)} required fullWidth />
                  <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
                    {file ? file.name : 'Choose image'}
                    <input ref={fileRef} hidden type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </Button>
                  <Button type="submit" variant="contained" disabled={uploading}>
                    {uploading ? 'Uploading…' : 'Publish flash deal'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {items?.length || 0} flash deal{(items?.length ?? 0) === 1 ? '' : 's'}
            </Typography>
          </Stack>
          {!items ? (
            <Grid container spacing={2}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Grid size={{ xs: 12, sm: 6 }} key={i}><Skeleton variant="rounded" height={220} /></Grid>
              ))}
            </Grid>
          ) : items.length === 0 ? (
            <Card variant="outlined"><CardContent>
              <Typography color="text.secondary">No flash deals yet — create your first.</Typography>
            </CardContent></Card>
          ) : (
            <Grid container spacing={2}>
              {items.map(f => {
                const expired = new Date(f.endsAt).getTime() <= Date.now()
                const pct = f.originalPrice > 0
                  ? Math.round(((f.originalPrice - f.salePrice) / f.originalPrice) * 100)
                  : 0
                return (
                  <Grid size={{ xs: 12, sm: 6 }} key={f.id}>
                    <Card sx={{ position: 'relative', overflow: 'hidden' }}>
                      <Box sx={{
                        aspectRatio: '16/10',
                        backgroundImage: `url(${f.imagePath})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter: expired ? 'grayscale(0.7)' : 'none',
                      }} />
                      <IconButton size="small" sx={{
                        position: 'absolute', top: 8, right: 8,
                        bgcolor: 'rgba(0,0,0,0.6)', color: '#fff',
                        '&:hover': { bgcolor: 'error.main' },
                      }} onClick={() => onDelete(f.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                      {pct > 0 && (
                        <Box sx={{
                          position: 'absolute', top: 8, left: 8,
                          bgcolor: '#e11d48', color: '#fff', fontSize: 12, fontWeight: 700,
                          px: 1, py: 0.25, borderRadius: 1,
                        }}>
                          −{pct}%
                        </Box>
                      )}
                      <CardContent>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 600 }}>{f.title}</Typography>
                          {expired && <Chip label="Expired" size="small" color="default" />}
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                          <Typography sx={{ color: '#e11d48', fontWeight: 700 }}>
                            ${f.salePrice.toFixed(2)}
                          </Typography>
                          {f.originalPrice > f.salePrice && (
                            <Typography sx={{ color: 'text.secondary', textDecoration: 'line-through', fontSize: 13 }}>
                              ${f.originalPrice.toFixed(2)}
                            </Typography>
                          )}
                        </Stack>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                          Stock {f.stock} · sold {f.sold} · ends {new Date(f.endsAt).toLocaleString()}
                        </Typography>
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
