import { useEffect, useMemo, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid, IconButton,
  MenuItem, Skeleton, Paper, Chip, Tooltip, InputAdornment, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableHead, TableRow, ListItemIcon, ListItemText,
} from '@mui/material'
import { useToast } from '../../components/Toast'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import SearchIcon from '@mui/icons-material/Search'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AddIcon from '@mui/icons-material/Add'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import { api } from '../../api'
import { ICONS, CategoryIcon, type CategoryIconDef } from '../../components/categoryIcons'

type Cat = { id: number; parentId: number | null; name: string; slug: string; icon: string; position: number }
type View = 'tree' | 'list'

export default function AdminCategories() {
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [parentId, setParentId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('tree')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [iconQuery, setIconQuery] = useState('')

  const load = () => api.adminCategories().then(setCats).catch(console.error)
  useEffect(() => { load() }, [])

  const slug = useMemo(() => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), [name])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required.'); return }
    setSaving(true)
    try {
      await api.adminCategoryCreate(name.trim(), icon.trim(), parentId || null)
      toast.success(`Category "${name.trim()}" added.`)
      setName(''); setIcon(''); setParentId('')
      await load()
    } catch (e) { toast.error(e) } finally { setSaving(false) }
  }
  const onDelete = async (c: Cat) => {
    if (!confirm(`Delete "${c.name}" and all its children?`)) return
    try {
      await api.adminCategoryDelete(c.id)
      toast.success(`Deleted "${c.name}".`)
      await load()
    } catch (e) { toast.error(e) }
  }

  type Node = Cat & { children: Node[]; depth: number; descendants: number }
  const { tree, byParent, topCount, subCount } = useMemo(() => {
    const byId = new Map<number, Node>()
    const byParentMap = new Map<number, number>()
    let top = 0, sub = 0
    if (!cats) return { tree: [] as Node[], byParent: byParentMap, topCount: 0, subCount: 0 }
    cats.forEach(c => byId.set(c.id, { ...c, children: [], depth: 0, descendants: 0 }))
    const roots: Node[] = []
    cats.forEach(c => {
      const n = byId.get(c.id)!
      if (c.parentId && byId.get(c.parentId)) {
        byId.get(c.parentId)!.children.push(n); sub++
      } else { roots.push(n); top++ }
    })
    const walk = (n: Node, d: number): number => {
      n.depth = d
      let count = n.children.length
      for (const ch of n.children) count += walk(ch, d + 1)
      n.descendants = count
      byParentMap.set(n.id, n.children.length)
      return count
    }
    roots.forEach(r => walk(r, 0))
    return { tree: roots, byParent: byParentMap, topCount: top, subCount: sub }
  }, [cats])

  const matchesQuery = (c: Cat) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  }

  const nodeVisible = (n: Node): boolean => {
    if (matchesQuery(n)) return true
    return n.children.some(nodeVisible)
  }

  const toggle = (id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const total = cats?.length ?? 0

  const filteredIcons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase()
    if (!q) return ICONS
    return ICONS.filter(i =>
      i.id.includes(q) || i.label.toLowerCase().includes(q) || i.keywords.includes(q)
    )
  }, [iconQuery])

  const pickIcon = (def: CategoryIconDef) => {
    setIcon(def.id); setPickerOpen(false); setIconQuery('')
  }

  const renderNode = (n: Node) => {
    if (!nodeVisible(n)) return null
    const isCollapsed = collapsed.has(n.id)
    const childCount = n.children.length
    return (
      <Box key={n.id}>
        <Stack direction="row" sx={{
          alignItems: 'center', gap: 1.25, p: 1, pl: 1.25,
          borderRadius: 1.5, border: 1, borderColor: 'divider',
          bgcolor: '#fff',
          transition: 'background-color .15s, border-color .15s, transform .15s',
          '&:hover': { bgcolor: '#fafbfc', borderColor: 'primary.light' },
        }}>
          <IconButton size="small" onClick={() => toggle(n.id)}
            disabled={childCount === 0}
            sx={{ width: 24, height: 24, opacity: childCount === 0 ? 0.2 : 1 }}>
            {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>

          <Box sx={{
            width: 32, height: 32, borderRadius: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: n.icon
              ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))'
              : '#f1f5f9',
            color: '#4f46e5',
            flexShrink: 0,
          }}>
            {n.icon
              ? <CategoryIcon name={n.icon} size={18} />
              : <CategoryOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }} noWrap>
              {n.name}
            </Typography>
            <Typography sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11, color: 'text.disabled',
            }} noWrap>
              /{n.slug}
            </Typography>
          </Box>

          {childCount > 0 && (
            <Chip size="small" label={`${childCount} child${childCount === 1 ? '' : 'ren'}`}
              sx={{ height: 20, fontSize: 11, fontWeight: 600, bgcolor: 'rgba(99,102,241,0.1)', color: 'primary.main' }} />
          )}

          <Tooltip title="Add subcategory">
            <IconButton size="small" onClick={() => setParentId(n.id)} sx={{ color: 'text.secondary' }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => onDelete(n)}
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'rgba(239,68,68,0.08)' } }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {childCount > 0 && (
          <Collapse in={!isCollapsed} timeout={200} unmountOnExit>
            <Box sx={{
              position: 'relative', ml: '11px', pl: '20px', mt: 0.5,
              borderLeft: '1px dashed', borderColor: 'divider',
            }}>
              <Stack spacing={0.5}>
                {n.children.map(ch => renderNode(ch))}
              </Stack>
            </Box>
          </Collapse>
        )}
      </Box>
    )
  }

  return (
    <Stack spacing={2.5}>
      {/* Hero */}
      <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 3,
        background: 'linear-gradient(135deg, #052e2b 0%, #064e3b 45%, #047857 100%)',
        color: '#fff', p: { xs: 2.5, md: 3.5 },
      }}>
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.22,
          background: 'radial-gradient(circle at 85% 15%, rgba(34,197,94,0.55), transparent 45%), radial-gradient(circle at 10% 90%, rgba(20,184,166,0.5), transparent 50%)',
        }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          sx={{ position: 'relative', alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 2,
              background: 'linear-gradient(135deg, #14b8a6, #22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px -8px rgba(20,184,166,0.6)',
            }}>
              <AccountTreeOutlinedIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Categories
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, mt: 0.5 }}>
                Build the catalogue tree sellers attach products to. Pick crisp SVG icons for the storefront.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatPill label="Total" value={total} accent="#fff" />
            <StatPill label="Top" value={topCount} accent="#22c55e" />
            <StatPill label="Sub" value={subCount} accent="#14b8a6" />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {/* Create form */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ position: 'sticky', top: 0, borderRadius: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <AddIcon sx={{ color: 'success.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>New category</Typography>
              </Stack>

              <form onSubmit={onCreate}>
                <Stack spacing={2}>
                  {/* Icon picker tile */}
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box
                      onClick={() => setPickerOpen(true)}
                      sx={{
                        width: 64, height: 64, borderRadius: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        background: icon
                          ? 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(34,197,94,0.15))'
                          : '#f8fafc',
                        border: '2px dashed', borderColor: icon ? 'success.light' : 'divider',
                        color: 'success.main',
                        transition: 'transform .15s, border-color .15s',
                        '&:hover': { transform: 'scale(1.03)', borderColor: 'success.main' },
                      }}>
                      {icon
                        ? <CategoryIcon name={icon} size={30} />
                        : <CategoryOutlinedIcon sx={{ fontSize: 24, color: 'text.disabled' }} />}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Button size="small" variant="outlined" fullWidth onClick={() => setPickerOpen(true)}
                        sx={{ textTransform: 'none', fontWeight: 600, mb: 0.5 }}>
                        {icon ? 'Change icon' : 'Pick an icon'}
                      </Button>
                      {icon && (
                        <Button size="small" onClick={() => setIcon('')} sx={{ textTransform: 'none', color: 'text.secondary' }} fullWidth>
                          Clear
                        </Button>
                      )}
                    </Box>
                  </Stack>

                  <TextField label="Name" size="small" value={name}
                    onChange={e => setName(e.target.value)} required fullWidth
                    placeholder="e.g. Electronics" />
                  <TextField label="Slug (auto)" size="small" value={slug} fullWidth disabled
                    slotProps={{
                      input: { startAdornment: <InputAdornment position="start">/</InputAdornment> },
                    }} />
                  <TextField select label="Parent" size="small" value={parentId}
                    onChange={e => setParentId(e.target.value === '' ? '' : Number(e.target.value))} fullWidth>
                    <MenuItem value="">— Top level —</MenuItem>
                    {cats?.map(c => (
                      <MenuItem key={c.id} value={c.id}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {c.icon ? <CategoryIcon name={c.icon} size={16} /> : <CategoryOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                        </ListItemIcon>
                        <ListItemText primary={c.name} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
                      </MenuItem>
                    ))}
                  </TextField>

                  <Button type="submit" variant="contained" size="large" disabled={saving}
                    sx={{
                      textTransform: 'none', fontWeight: 700, py: 1.1,
                      background: 'linear-gradient(135deg, #14b8a6, #16a34a)',
                      '&:hover': { background: 'linear-gradient(135deg, #2dd4bf, #15803d)' },
                    }}>
                    {saving ? 'Adding…' : 'Add category'}
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Tree / list */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1.5 }}>
            <TextField size="small" placeholder="Search categories…" value={query}
              onChange={e => setQuery(e.target.value)} sx={{ minWidth: 260 }}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
              }} />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              {view === 'tree' && (
                <Button size="small" onClick={() =>
                  setCollapsed(prev => prev.size > 0 ? new Set() : new Set(cats?.filter(c => byParent.get(c.id)).map(c => c.id) || []))
                } sx={{ textTransform: 'none', color: 'text.secondary' }}>
                  {collapsed.size > 0 ? 'Expand all' : 'Collapse all'}
                </Button>
              )}
              <ToggleButtonGroup value={view} exclusive size="small"
                onChange={(_, v: View | null) => v && setView(v)}>
                <ToggleButton value="tree"><AccountTreeOutlinedIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="list"><ViewListRoundedIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          {!cats ? (
            <Skeleton variant="rounded" height={300} />
          ) : cats.length === 0 ? (
            <Card variant="outlined" sx={{ borderStyle: 'dashed' }}>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <CategoryOutlinedIcon sx={{ fontSize: 40, color: 'grey.300', mb: 1 }} />
                <Typography color="text.secondary">No categories yet — start with a top-level one.</Typography>
              </CardContent>
            </Card>
          ) : view === 'tree' ? (
            <Stack spacing={0.75}>{tree.map(n => renderNode(n))}</Stack>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Slug</TableCell>
                    <TableCell>Parent</TableCell>
                    <TableCell align="right">Children</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cats.filter(matchesQuery).map(c => {
                    const childCount = byParent.get(c.id) || 0
                    const parent = c.parentId ? cats.find(p => p.id === c.parentId) : null
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ width: 48 }}>
                          <Box sx={{
                            width: 32, height: 32, borderRadius: 1.5,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: c.icon
                              ? 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(34,197,94,0.12))'
                              : '#f1f5f9',
                            color: '#0f766e',
                          }}>
                            {c.icon
                              ? <CategoryIcon name={c.icon} size={18} />
                              : <CategoryOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
                          </Box>
                        </TableCell>
                        <TableCell><Typography sx={{ fontWeight: 600, fontSize: 14 }}>{c.name}</Typography></TableCell>
                        <TableCell><Box sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>/{c.slug}</Box></TableCell>
                        <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{parent?.name || '—'}</TableCell>
                        <TableCell align="right">
                          <Chip size="small" label={childCount}
                            sx={{ height: 20, fontSize: 11, fontWeight: 700, minWidth: 32,
                              bgcolor: childCount > 0 ? 'rgba(20,184,166,0.12)' : 'grey.100',
                              color: childCount > 0 ? '#0f766e' : 'text.secondary' }} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => onDelete(c)}
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
        </Grid>
      </Grid>

      {/* Icon picker dialog */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteHintIcon /> Pick a category icon
        </DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth autoFocus size="small" placeholder="Search icons…"
            value={iconQuery} onChange={e => setIconQuery(e.target.value)}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            }} />
          <Box sx={{
            display: 'grid', gap: 1, mt: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          }}>
            {filteredIcons.map(def => {
              const selected = def.id === icon
              return (
                <Tooltip key={def.id} title={def.label}>
                  <Box
                    onClick={() => pickIcon(def)}
                    sx={{
                      cursor: 'pointer', borderRadius: 2, p: 1.25,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                      border: 2, borderColor: selected ? 'primary.main' : 'transparent',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))'
                        : 'transparent',
                      transition: 'background-color .15s, transform .15s, border-color .15s',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', transform: 'translateY(-2px)' },
                    }}>
                    <CategoryIcon name={def.id} size={26} sx={{ color: selected ? 'primary.main' : 'text.primary' }} />
                    <Typography sx={{ fontSize: 10.5, color: 'text.secondary', textAlign: 'center', lineHeight: 1.1 }} noWrap>
                      {def.label}
                    </Typography>
                  </Box>
                </Tooltip>
              )
            })}
            {filteredIcons.length === 0 && (
              <Typography sx={{ gridColumn: '1/-1', textAlign: 'center', color: 'text.secondary', py: 4 }}>
                No icons match "{iconQuery}".
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {icon && (
            <Button onClick={() => { setIcon(''); setPickerOpen(false) }} sx={{ mr: 'auto', color: 'text.secondary' }}>
              Remove icon
            </Button>
          )}
          <Button onClick={() => setPickerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
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

function PaletteHintIcon() {
  return <CategoryOutlinedIcon sx={{ color: 'primary.main' }} />
}
