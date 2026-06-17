import { useEffect, useMemo, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid, IconButton,
  MenuItem, Alert, Skeleton,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { api } from '../../api'

type Cat = { id: number; parentId: number | null; name: string; slug: string; icon: string; position: number }

export default function AdminCategories() {
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [parentId, setParentId] = useState<number | ''>('')
  const [err, setErr] = useState<string | null>(null)

  const load = () => api.adminCategories().then(setCats).catch(console.error)
  useEffect(() => { load() }, [])

  const slug = useMemo(() => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), [name])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    try {
      await api.adminCategoryCreate(name.trim(), icon.trim(), parentId || null)
      setName(''); setIcon(''); setParentId('')
      await load()
    } catch (e) { setErr((e as Error).message) }
  }
  const onDelete = async (id: number) => {
    if (!confirm('Delete this category and all its children?')) return
    await api.adminCategoryDelete(id); await load()
  }

  type Node = Cat & { children: Node[] }
  const tree: Node[] = useMemo(() => {
    if (!cats) return []
    const byId = new Map<number, Node>()
    cats.forEach(c => byId.set(c.id, { ...c, children: [] }))
    const roots: Node[] = []
    cats.forEach(c => {
      const n = byId.get(c.id)!
      if (c.parentId && byId.get(c.parentId)) byId.get(c.parentId)!.children.push(n)
      else roots.push(n)
    })
    return roots
  }, [cats])

  const renderNode = (n: Node, depth = 0) => (
    <Box key={n.id}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, p: 1.25, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, ml: depth * 3 }}>
        {n.icon && <Box sx={{ fontSize: 18 }}>{n.icon}</Box>}
        <Typography sx={{ fontWeight: 600 }}>{n.name}</Typography>
        <Typography sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: 'text.secondary' }}>/{n.slug}</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => onDelete(n.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
      </Stack>
      {n.children.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>{n.children.map(c => renderNode(c, depth + 1))}</Stack>
      )}
    </Box>
  )

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Categories</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ position: 'sticky', top: 0 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>New category</Typography>
              <form onSubmit={onCreate}>
                <Stack spacing={2}>
                  {err && <Alert severity="error">{err}</Alert>}
                  <TextField label="Name" value={name} onChange={e => setName(e.target.value)} required fullWidth />
                  <TextField label="Slug (auto)" value={slug} fullWidth disabled />
                  <TextField label="Icon (emoji)" value={icon} onChange={e => setIcon(e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 32 } }} />
                  <TextField select label="Parent" value={parentId} onChange={e => setParentId(e.target.value === '' ? '' : Number(e.target.value))} fullWidth>
                    <MenuItem value="">— Top level —</MenuItem>
                    {cats?.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </TextField>
                  <Button type="submit" variant="contained">Add category</Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
            {cats?.length || 0} total
          </Typography>
          {!cats ? <Skeleton variant="rounded" height={300} /> : (
            <Stack spacing={0.5}>{tree.map(n => renderNode(n))}</Stack>
          )}
        </Grid>
      </Grid>
    </Stack>
  )
}
