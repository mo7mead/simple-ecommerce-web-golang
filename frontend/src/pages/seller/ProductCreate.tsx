import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Stack, Typography, Card, CardContent, TextField, Button, Grid, Alert, Box,
  MenuItem, Divider, Chip, FormControl, InputLabel, Select,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { api, type Category, type Brand } from '../../api'
import { useToast } from '../../components/Toast'

export default function SellerProductCreate() {
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0.00')
  const [stock, setStock] = useState('1')
  const [shippingDays, setShippingDays] = useState('3')
  const [topCatId, setTopCatId] = useState<number | ''>('')
  const [subCatId, setSubCatId] = useState<number | ''>('')
  const [brandId, setBrandId] = useState<number | ''>('')
  const [image, setImage] = useState<File | null>(null)

  const [created, setCreated] = useState<{ sku: string; status: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.categories().then((c) => setCategories(c || [])).catch(console.error)
    api.brands().then((b) => setBrands(b || [])).catch(console.error)
  }, [])

  const topCat = useMemo(
    () => categories.find((c) => c.id === topCatId) || null,
    [categories, topCatId],
  )
  const subCats = topCat?.children || []

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required.'); return }
    const p = parseFloat(price)
    const s = parseInt(stock, 10)
    const sd = parseInt(shippingDays, 10)
    if (!isFinite(p) || p < 0) { toast.error('Price is invalid.'); return }
    if (!isFinite(s) || s < 0) { toast.error('Quantity is invalid.'); return }
    if (!isFinite(sd) || sd < 0) { toast.error('Shipping days is invalid.'); return }

    setSaving(true)
    try {
      const cat: number | '' = subCatId !== '' ? subCatId : topCatId
      const res = await api.sellerProductCreate({
        name: name.trim(), description: description.trim(),
        price: p, stock: s, shippingDays: sd,
        categoryId: cat === '' ? null : cat,
        brandId: brandId === '' ? null : brandId,
        image,
      })
      toast.success(`Product submitted · SKU ${res.sku}`)
      setCreated({ sku: res.sku, status: res.status })
    } catch (e) { toast.error(e) } finally { setSaving(false) }
  }

  if (created) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Product submitted</Typography>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Alert severity="success">
                Your product has been submitted and is awaiting administrator review.
              </Alert>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>SKU</Typography>
                <Box sx={{
                  fontFamily: 'monospace', fontWeight: 700, fontSize: 16,
                  bgcolor: 'primary.main', color: 'primary.contrastText',
                  px: 1.5, py: 0.5, borderRadius: 1, letterSpacing: 1,
                }}>{created.sku}</Box>
                <Chip label={created.status} color="warning" size="small" />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => {
                  setCreated(null); setName(''); setDescription(''); setPrice('0.00'); setStock('1')
                  setShippingDays('3'); setTopCatId(''); setSubCatId(''); setBrandId(''); setImage(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}>Create another</Button>
                <Button variant="outlined" onClick={() => nav('/seller/products')}>
                  Back to products
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button component={RouterLink} to="/seller/products" startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'none' }}>Products</Button>
        <Divider orientation="vertical" flexItem />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Create product</Typography>
      </Stack>

      <Card sx={{ maxWidth: 880 }}>
        <CardContent>
          <form onSubmit={onSubmit}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField label="Product name" value={name} onChange={(e) => setName(e.target.value)}
                  required fullWidth autoFocus />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack sx={{
                  bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1, p: 1.5, height: '100%',
                  justifyContent: 'center',
                }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    SKU
                  </Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>
                    Z1-XXXXXXXX
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    Auto-generated on submit
                  </Typography>
                </Stack>
              </Grid>

              <Grid size={12}>
                <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
                  fullWidth multiline rows={3}
                  placeholder="Materials, dimensions, what's in the box…" />
              </Grid>

              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  required fullWidth slotProps={{ htmlInput: { step: '0.01', min: '0' } }} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField label="Quantity" type="number" value={stock} onChange={(e) => setStock(e.target.value)}
                  required fullWidth slotProps={{ htmlInput: { min: '0' } }} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label="Shipping days" type="number" value={shippingDays}
                  onChange={(e) => setShippingDays(e.target.value)} fullWidth
                  helperText="Expected days to ship after order is placed"
                  slotProps={{ htmlInput: { min: '0' } }} />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select label="Category" value={topCatId}
                    onChange={(e) => { setTopCatId(e.target.value as number); setSubCatId('') }}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth disabled={subCats.length === 0}>
                  <InputLabel>Subcategory</InputLabel>
                  <Select label="Subcategory" value={subCatId}
                    onChange={(e) => setSubCatId(e.target.value as number)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {subCats.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Brand</InputLabel>
                  <Select label="Brand" value={brandId}
                    onChange={(e) => setBrandId(e.target.value as number)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {brands.map((b) => (
                      <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
                  <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
                    {image ? image.name : 'Upload product image'}
                    <input ref={fileRef} hidden type="file" accept="image/*"
                      onChange={(e) => setImage(e.target.files?.[0] || null)} />
                  </Button>
                  {image && (
                    <Box component="img" src={URL.createObjectURL(image)}
                      sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1 }} alt="" />
                  )}
                </Stack>
              </Grid>

              <Grid size={12}>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Once you submit, the product will be marked <strong>pending</strong> and reviewed by an administrator before it goes live.
                </Alert>
              </Grid>

              <Grid size={12}>
                <Stack direction="row" spacing={1}>
                  <Button type="submit" variant="contained" disabled={saving}>
                    {saving ? 'Submitting…' : 'Submit for review'}
                  </Button>
                  <Button component={RouterLink} to="/seller/products" variant="text">Cancel</Button>
                </Stack>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Stack>
  )
}
