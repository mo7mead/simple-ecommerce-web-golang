import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
  TextField, MenuItem, FormControlLabel, Switch, Menu, ListItemIcon,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import HomeIcon from '@mui/icons-material/Home'
import BusinessIcon from '@mui/icons-material/Business'
import PlaceIcon from '@mui/icons-material/Place'
import { api, type Address, type AddressInput } from '../../api'
import { useToast } from '../../components/Toast'

type Sort = 'default' | 'newest' | 'oldest' | 'label'

const SUGGESTED_LABELS = ['Home', 'Office', 'Family', 'Other']

const emptyInput: AddressInput = { label: '', recipient: '', phone: '', line: '', isDefault: false }

export default function BuyerAddresses() {
  const [list, setList] = useState<Address[] | null>(null)
  const [editing, setEditing] = useState<Address | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<AddressInput>(emptyInput)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('default')
  const [toDelete, setToDelete] = useState<Address | null>(null)
  const toast = useToast()

  const load = () =>
    api.addresses().then(r => setList(r || [])).catch(() => setList([]))
  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    if (!list) return []
    const term = q.trim().toLowerCase()
    const arr = term
      ? list.filter(a =>
          a.label.toLowerCase().includes(term) ||
          a.recipient.toLowerCase().includes(term) ||
          a.line.toLowerCase().includes(term))
      : list.slice()
    arr.sort((a, b) => {
      switch (sort) {
        case 'newest':  return +new Date(b.createdAt) - +new Date(a.createdAt)
        case 'oldest':  return +new Date(a.createdAt) - +new Date(b.createdAt)
        case 'label':   return (a.label || a.recipient).localeCompare(b.label || b.recipient)
        default:        return Number(b.isDefault) - Number(a.isDefault) || b.id - a.id
      }
    })
    return arr
  }, [list, q, sort])

  const defaultAddr = (list || []).find(a => a.isDefault)

  const openNew = () => { setEditing(null); setForm(emptyInput); setFormOpen(true) }
  const openEdit = (a: Address) => {
    setEditing(a)
    setForm({ label: a.label, recipient: a.recipient, phone: a.phone, line: a.line, isDefault: a.isDefault })
    setFormOpen(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      if (editing) await api.addressUpdate(editing.id, form)
      else await api.addressCreate(form)
      toast.success(editing ? 'Address updated.' : 'Address added.')
      setFormOpen(false); await load()
    } catch (e) { toast.error(e) }
    finally { setBusy(false) }
  }

  const setDefault = async (a: Address) => {
    try {
      await api.addressSetDefault(a.id)
      toast.success(`${a.label || a.recipient} is now your default.`)
      await load()
    } catch (e) { toast.error(e) }
  }

  const copy = async (a: Address) => {
    const text = `${a.recipient}\n${a.phone}\n${a.line}`
    try { await navigator.clipboard.writeText(text); toast.success('Address copied.') }
    catch { toast.error('Copy failed.') }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      await api.addressDelete(toDelete.id)
      toast.success('Address deleted.')
      setToDelete(null); await load()
    } catch (e) { toast.error(e) }
    finally { setBusy(false) }
  }

  return (
    <Stack spacing={3}>
      <Header
        count={list?.length ?? 0}
        defaultRecipient={defaultAddr?.recipient}
        onAdd={openNew}
      />

      {list && list.length > 0 && (
        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                size="small" placeholder="Search label, recipient, or address…"
                value={q} onChange={e => setQ(e.target.value)} sx={{ flex: 1, minWidth: 240 }}
              />
              <TextField select size="small" label="Sort" value={sort}
                onChange={e => setSort(e.target.value as Sort)} sx={{ minWidth: 180 }}>
                <MenuItem value="default">Default first</MenuItem>
                <MenuItem value="newest">Newest first</MenuItem>
                <MenuItem value="oldest">Oldest first</MenuItem>
                <MenuItem value="label">Label A–Z</MenuItem>
              </TextField>
            </Stack>
          </CardContent>
        </Card>
      )}

      {list === null ? (
        <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>
      ) : list.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : visible.length === 0 ? (
        <Card><CardContent>
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
            No addresses match your search.
          </Typography>
        </CardContent></Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {visible.map(a => (
            <AddressCard
              key={a.id} address={a}
              onEdit={() => openEdit(a)} onDelete={() => setToDelete(a)}
              onSetDefault={() => setDefault(a)} onCopy={() => copy(a)}
            />
          ))}
        </Box>
      )}

      <FormDialog
        open={formOpen} editing={editing} value={form} busy={busy}
        onChange={setForm} onClose={() => setFormOpen(false)} onSave={save}
      />

      <Dialog open={toDelete !== null} onClose={() => !busy && setToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this address?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will permanently remove the address from your account.
          </DialogContentText>
          {toDelete && (
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, borderLeft: 3, borderColor: 'error.main' }}>
              {toDelete.label && <Chip size="small" label={toDelete.label} sx={{ mb: 1 }} />}
              <Typography sx={{ fontWeight: 600 }}>{toDelete.recipient}</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{toDelete.phone}</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{toDelete.line}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setToDelete(null)} disabled={busy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={busy} startIcon={<DeleteIcon />}>
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

/* -------- Sub-components -------- */

function Header({ count, defaultRecipient, onAdd }:
  { count: number; defaultRecipient?: string; onAdd: () => void }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Saved addresses</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          {count === 0
            ? 'Add an address to speed up checkout.'
            : `${count} saved · ${defaultRecipient ? `default ships to ${defaultRecipient}` : 'no default set'}.`}
        </Typography>
      </Box>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>Add address</Button>
    </Stack>
  )
}

function AddressCard({ address: a, onEdit, onDelete, onSetDefault, onCopy }:
  {
    address: Address
    onEdit: () => void; onDelete: () => void
    onSetDefault: () => void; onCopy: () => void
  }) {
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null)
  const closeMenu = () => setMenuEl(null)
  const Icon = labelIcon(a.label)

  return (
    <Card sx={{
      position: 'relative', overflow: 'hidden',
      borderColor: a.isDefault ? 'primary.main' : 'divider',
      borderWidth: a.isDefault ? 2 : 1, borderStyle: 'solid',
      transition: 'box-shadow 0.15s', '&:hover': { boxShadow: 3 },
    }}>
      {a.isDefault && (
        <Box sx={{
          position: 'absolute', top: 12, right: -32, transform: 'rotate(35deg)',
          bgcolor: 'primary.main', color: '#fff', px: 4, py: 0.25,
          fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
        }}>Default</Box>
      )}
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '50%',
            bgcolor: a.isDefault ? 'primary.main' : '#e2e8f0',
            color: a.isDefault ? '#fff' : '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon fontSize="small" /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              {a.label || 'Address'}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              Added {new Date(a.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
          <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} aria-label="Actions">
            <MoreVertIcon />
          </IconButton>
        </Stack>

        <Stack spacing={0.5} sx={{ pl: 0.5 }}>
          <Typography sx={{ fontWeight: 600 }}>{a.recipient}</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{a.phone}</Typography>
          <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{a.line}</Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {!a.isDefault && (
            <Button size="small" startIcon={<StarBorderIcon />} onClick={onSetDefault}>
              Set as default
            </Button>
          )}
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={onEdit}>
            Edit
          </Button>
        </Stack>

        <Menu anchorEl={menuEl} open={!!menuEl} onClose={closeMenu}>
          {!a.isDefault && (
            <MenuItem onClick={() => { closeMenu(); onSetDefault() }}>
              <ListItemIcon><StarIcon fontSize="small" /></ListItemIcon>
              Set as default
            </MenuItem>
          )}
          <MenuItem onClick={() => { closeMenu(); onEdit() }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            Edit
          </MenuItem>
          <MenuItem onClick={() => { closeMenu(); onCopy() }}>
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            Copy address
          </MenuItem>
          <MenuItem onClick={() => { closeMenu(); onDelete() }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            Delete
          </MenuItem>
        </Menu>
      </CardContent>
    </Card>
  )
}

function FormDialog({ open, editing, value, busy, onChange, onClose, onSave }: {
  open: boolean
  editing: Address | null
  value: AddressInput
  busy: boolean
  onChange: (v: AddressInput) => void
  onClose: () => void
  onSave: () => void
}) {
  const valid = value.recipient.trim() && value.phone.trim() && value.line.trim()
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Edit address' : 'Add a new address'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box>
            <TextField label="Label (optional)" placeholder="Home, Office…"
              value={value.label} onChange={e => onChange({ ...value, label: e.target.value })}
              fullWidth />
            <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.75 }}>
              {SUGGESTED_LABELS.map(s => (
                <Chip key={s} size="small" label={s} clickable variant="outlined"
                  onClick={() => onChange({ ...value, label: s })} />
              ))}
            </Stack>
          </Box>
          <TextField label="Recipient name" value={value.recipient} required
            onChange={e => onChange({ ...value, recipient: e.target.value })} fullWidth
            autoFocus={!editing} />
          <TextField label="Phone" value={value.phone} required
            onChange={e => onChange({ ...value, phone: e.target.value })} fullWidth />
          <TextField label="Address" value={value.line} required multiline minRows={3}
            onChange={e => onChange({ ...value, line: e.target.value })} fullWidth
            helperText="Street, building, city — anything the courier needs." />
          <FormControlLabel
            control={<Switch checked={value.isDefault}
              onChange={e => onChange({ ...value, isDefault: e.target.checked })} />}
            label="Use as my default address"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={busy || !valid}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add address'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 8 }}>
        <Box sx={{
          width: 88, height: 88, borderRadius: '50%', bgcolor: '#eef2ff', color: 'primary.main',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2,
        }}>
          <LocationOnIcon sx={{ fontSize: 44 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>No addresses saved yet</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 3, maxWidth: 420, mx: 'auto' }}>
          Add at least one address so you can check out in one tap. You can label them
          Home, Office, or anything else — and pick a default for the fastest checkout.
        </Typography>
        <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={onAdd}>
          Add your first address
        </Button>
      </CardContent>
    </Card>
  )
}

function labelIcon(label: string) {
  const k = label.trim().toLowerCase()
  if (k === 'home' || k === 'house') return HomeIcon
  if (k === 'office' || k === 'work' || k === 'business') return BusinessIcon
  return PlaceIcon
}
