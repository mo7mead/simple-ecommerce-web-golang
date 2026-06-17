import { useEffect, useRef, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid, IconButton,
  Alert, Skeleton, Link,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { api, type Brand } from '../../api'

export default function AdminBrands() {
  const [items, setItems] = useState<Brand[] | null>(null)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => api.adminBrands().then(s => setItems(s || [])).catch(console.error)
  useEffect(() => { load() }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    if (!name.trim()) { setErr('Name is required.'); return }
    setSaving(true)
    try {
      await api.adminBrandCreate({ name: name.trim(), website: website.trim(), logo })
      setName(''); setWebsite(''); setLogo(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (e) { setErr((e as Error).message) } finally { setSaving(false) }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this brand?')) return
    await api.adminBrandDelete(id); await load()
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <StorefrontIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Brands</Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ position: 'sticky', top: 0 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>New brand</Typography>
              <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                  {err && <Alert severity="error">{err}</Alert>}
                  <TextField label="Name" value={name} onChange={e => setName(e.target.value)} required fullWidth />
                  <TextField label="Website" placeholder="https://…" value={website}
                    onChange={e => setWebsite(e.target.value)} fullWidth />
                  <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
                    {logo ? logo.name : 'Choose logo'}
                    <input ref={fileRef} hidden type="file" accept="image/*"
                      onChange={e => setLogo(e.target.files?.[0] || null)} />
                  </Button>
                  <Button type="submit" variant="contained" disabled={saving}>
                    {saving ? 'Saving…' : 'Add brand'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {items?.length || 0} brand{(items?.length ?? 0) === 1 ? '' : 's'}
            </Typography>
          </Stack>
          {!items ? (
            <Grid container spacing={2}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}><Skeleton variant="rounded" height={140} /></Grid>
              ))}
            </Grid>
          ) : items.length === 0 ? (
            <Card variant="outlined"><CardContent>
              <Typography color="text.secondary">No brands yet — add your first.</Typography>
            </CardContent></Card>
          ) : (
            <Grid container spacing={2}>
              {items.map(b => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={b.id}>
                  <Card sx={{ position: 'relative', height: '100%' }}>
                    <IconButton size="small" sx={{
                      position: 'absolute', top: 4, right: 4,
                      bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                      '&:hover': { bgcolor: 'error.main' },
                    }} onClick={() => onDelete(b.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    <Box sx={{
                      height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                    }}>
                      {b.logoPath ? (
                        <Box component="img" src={b.logoPath} alt={b.name}
                          sx={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Typography sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 22 }}>
                          {b.name[0]?.toUpperCase()}
                        </Typography>
                      )}
                    </Box>
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{b.name}</Typography>
                      {b.website && (
                        <Link href={b.website} target="_blank" rel="noopener" underline="hover"
                          sx={{ fontSize: 12, color: 'text.secondary', display: 'block',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.website.replace(/^https?:\/\//, '')}
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Stack>
  )
}
