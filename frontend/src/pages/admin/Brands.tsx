import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid, IconButton,
  Skeleton, Link, Paper, ToggleButton, ToggleButtonGroup, InputAdornment,
  Tooltip, Chip, Avatar, Divider, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material'
import { useToast } from '../../components/Toast'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import StorefrontIcon from '@mui/icons-material/Storefront'
import SearchIcon from '@mui/icons-material/Search'
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AddBusinessOutlinedIcon from '@mui/icons-material/AddBusinessOutlined'
import { api, type Brand, type Product } from '../../api'

type View = 'grid' | 'list'

export default function AdminBrands() {
  const [items, setItems] = useState<Brand[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('grid')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => api.adminBrands().then(s => setItems(s || [])).catch(console.error)
  useEffect(() => { load() }, [])
  useEffect(() => {
    api.adminProducts('all').then(p => setProducts(p || [])).catch(console.error)
  }, [])

  useEffect(() => {
    if (!logo) { setLogoPreview(null); return }
    const url = URL.createObjectURL(logo)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logo])

  const productCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) {
      if (!p.brandName) continue
      m.set(p.brandName, (m.get(p.brandName) || 0) + 1)
    }
    return m
  }, [products])

  const filtered = useMemo(() => {
    if (!items) return null
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.website || '').toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q)
    )
  }, [items, query])

  const total = items?.length ?? 0
  const withLogo = items?.filter(b => !!b.logoPath).length ?? 0
  const withSite = items?.filter(b => !!b.website).length ?? 0

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required.'); return }
    setSaving(true)
    try {
      await api.adminBrandCreate({ name: name.trim(), website: website.trim(), logo })
      toast.success(`Brand "${name.trim()}" added.`)
      setName(''); setWebsite(''); setLogo(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (e) { toast.error(e) } finally { setSaving(false) }
  }

  const onDelete = async (id: number, brandName: string) => {
    const used = productCount.get(brandName) || 0
    const extra = used > 0 ? `\n\n${used} product${used === 1 ? '' : 's'} reference this brand.` : ''
    if (!confirm(`Delete "${brandName}"?${extra}`)) return
    await api.adminBrandDelete(id); await load()
  }

  return (
    <Stack spacing={2.5}>
      <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 3,
        background: 'linear-gradient(135deg, #0b1437 0%, #1e1b4b 45%, #312e81 100%)',
        color: '#fff', p: { xs: 2.5, md: 3.5 },
      }}>
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.22,
          background: 'radial-gradient(circle at 85% 15%, rgba(56,189,248,0.55), transparent 45%), radial-gradient(circle at 10% 90%, rgba(168,85,247,0.5), transparent 50%)',
        }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          sx={{ position: 'relative', alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 2,
              background: 'linear-gradient(135deg, #38bdf8, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px -8px rgba(168,85,247,0.6)',
            }}>
              <StorefrontIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Brands
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, mt: 0.5 }}>
                Manage the brands that sellers can attach to their products.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatPill label="Total" value={total} accent="#fff" />
            <StatPill label="Logos" value={withLogo} accent="#38bdf8" />
            <StatPill label="With site" value={withSite} accent="#a855f7" />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {/* Create form */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ position: 'sticky', top: 0, borderRadius: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <AddBusinessOutlinedIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>New brand</Typography>
              </Stack>

              <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 120, borderRadius: 2,
                    border: '2px dashed', borderColor: 'divider',
                    bgcolor: '#f8fafc', position: 'relative', overflow: 'hidden',
                  }}>
                    {logoPreview ? (
                      <Box component="img" src={logoPreview} alt=""
                        sx={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <Stack spacing={0.5} sx={{ color: 'text.secondary', alignItems: 'center' }}>
                        <StorefrontIcon sx={{ fontSize: 32 }} />
                        <Typography sx={{ fontSize: 12 }}>Logo preview</Typography>
                      </Stack>
                    )}
                  </Box>

                  <TextField label="Name" size="small" value={name}
                    onChange={e => setName(e.target.value)} required fullWidth />
                  <TextField label="Website" size="small" placeholder="https://…" value={website}
                    onChange={e => setWebsite(e.target.value)} fullWidth
                    slotProps={{
                      input: { startAdornment: <InputAdornment position="start"><LanguageOutlinedIcon fontSize="small" /></InputAdornment> },
                    }} />

                  <Button component="label" variant="outlined" size="small" startIcon={<CloudUploadIcon />}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>
                    {logo ? logo.name : 'Choose logo'}
                    <input ref={fileRef} hidden type="file" accept="image/*"
                      onChange={e => setLogo(e.target.files?.[0] || null)} />
                  </Button>

                  <Button type="submit" variant="contained" size="large" disabled={saving}
                    sx={{
                      textTransform: 'none', fontWeight: 700, py: 1.1,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      '&:hover': { background: 'linear-gradient(135deg, #818cf8, #7c3aed)' },
                    }}>
                    {saving ? 'Saving…' : 'Add brand'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* List */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1.5 }}>
            <TextField size="small" placeholder="Search brands…" value={query}
              onChange={e => setQuery(e.target.value)} sx={{ minWidth: 260 }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
              }} />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                {filtered?.length ?? 0} of {total}
              </Typography>
              <ToggleButtonGroup value={view} exclusive size="small"
                onChange={(_, v: View | null) => v && setView(v)}>
                <ToggleButton value="grid"><GridViewRoundedIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="list"><ViewListRoundedIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          {!filtered ? (
            <Grid container spacing={2}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}><Skeleton variant="rounded" height={180} /></Grid>
              ))}
            </Grid>
          ) : filtered.length === 0 ? (
            <Card variant="outlined" sx={{ borderStyle: 'dashed' }}>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <StorefrontIcon sx={{ fontSize: 40, color: 'grey.300', mb: 1 }} />
                <Typography color="text.secondary">
                  {query ? 'No brands match your search.' : 'No brands yet — add your first.'}
                </Typography>
              </CardContent>
            </Card>
          ) : view === 'grid' ? (
            <Grid container spacing={2}>
              {filtered.map(b => {
                const count = productCount.get(b.name) || 0
                return (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={b.id}>
                    <Card sx={{
                      position: 'relative', height: '100%', borderRadius: 2.5, overflow: 'hidden',
                      transition: 'transform .2s, box-shadow .2s',
                      '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
                      '&:hover .brand-actions': { opacity: 1 },
                    }}>
                      <Box className="brand-actions" sx={{
                        position: 'absolute', top: 6, right: 6, zIndex: 1,
                        display: 'flex', gap: 0.5,
                        opacity: 0, transition: 'opacity .2s',
                      }}>
                        {b.website && (
                          <Tooltip title="Open website">
                            <IconButton size="small" component="a" href={b.website} target="_blank" rel="noopener"
                              sx={{ bgcolor: 'rgba(15,23,42,0.7)', color: '#fff', backdropFilter: 'blur(6px)',
                                '&:hover': { bgcolor: 'primary.main' } }}>
                              <OpenInNewIcon fontSize="small" sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => onDelete(b.id, b.name)}
                            sx={{ bgcolor: 'rgba(15,23,42,0.7)', color: '#fff', backdropFilter: 'blur(6px)',
                              '&:hover': { bgcolor: 'error.main' } }}>
                            <DeleteOutlineIcon fontSize="small" sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Box sx={{
                        height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        p: 2.5, background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderBottom: '1px solid', borderColor: 'divider',
                      }}>
                        {b.logoPath ? (
                          <Box component="img" src={b.logoPath} alt={b.name}
                            sx={{
                              maxHeight: '100%', maxWidth: '100%', objectFit: 'contain',
                              filter: 'drop-shadow(0 4px 8px rgba(15,23,42,0.08))',
                            }} />
                        ) : (
                          <Avatar sx={{
                            width: 52, height: 52,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            fontSize: 22, fontWeight: 800,
                          }}>
                            {b.name[0]?.toUpperCase()}
                          </Avatar>
                        )}
                      </Box>

                      <CardContent sx={{ p: 1.5, pb: '12px !important' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }} noWrap>
                          {b.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace' }} noWrap>
                          {b.slug}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                          <Chip size="small" label={`${count} product${count === 1 ? '' : 's'}`}
                            sx={{ height: 20, fontSize: 11, fontWeight: 600,
                              bgcolor: count > 0 ? 'rgba(99,102,241,0.1)' : 'grey.100',
                              color: count > 0 ? 'primary.main' : 'text.secondary' }} />
                          {b.website && (
                            <Link href={b.website} target="_blank" rel="noopener" underline="hover"
                              sx={{ fontSize: 11, color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                              <LanguageOutlinedIcon sx={{ fontSize: 12 }} />
                              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                                {b.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                              </Box>
                            </Link>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Brand</TableCell>
                    <TableCell>Slug</TableCell>
                    <TableCell>Website</TableCell>
                    <TableCell align="right">Products</TableCell>
                    <TableCell align="right">Added</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(b => {
                    const count = productCount.get(b.name) || 0
                    return (
                      <TableRow key={b.id} hover>
                        <TableCell sx={{ width: 56 }}>
                          {b.logoPath ? (
                            <Avatar variant="rounded" src={b.logoPath} sx={{ width: 40, height: 40, bgcolor: '#f8fafc', '& img': { objectFit: 'contain' } }} />
                          ) : (
                            <Avatar variant="rounded" sx={{ width: 40, height: 40, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', fontWeight: 700 }}>
                              {b.name[0]?.toUpperCase()}
                            </Avatar>
                          )}
                        </TableCell>
                        <TableCell><Typography sx={{ fontWeight: 600, fontSize: 14 }}>{b.name}</Typography></TableCell>
                        <TableCell><Box sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>{b.slug}</Box></TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          {b.website ? (
                            <Link href={b.website} target="_blank" rel="noopener" underline="hover"
                              sx={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                              {b.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                              <OpenInNewIcon sx={{ fontSize: 12 }} />
                            </Link>
                          ) : <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>—</Typography>}
                        </TableCell>
                        <TableCell align="right">
                          <Chip size="small" label={count}
                            sx={{ height: 20, fontSize: 11, fontWeight: 700, minWidth: 32,
                              bgcolor: count > 0 ? 'rgba(99,102,241,0.1)' : 'grey.100',
                              color: count > 0 ? 'primary.main' : 'text.secondary' }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, color: 'text.secondary' }}>
                          {new Date(b.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => onDelete(b.id, b.name)}
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
          )}

          {filtered && filtered.length > 0 && (
            <>
              <Divider sx={{ mt: 2 }} />
              <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 1.25, textAlign: 'center' }}>
                Logos display best as transparent PNG or SVG.
              </Typography>
            </>
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
