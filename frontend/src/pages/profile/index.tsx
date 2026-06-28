import { useEffect, useRef, useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button, Typography, Stack, Avatar,
  Chip, Grid, Divider, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from '@mui/material'
import { useToast } from '../../components/Toast'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteIcon from '@mui/icons-material/Delete'
import ImageIcon from '@mui/icons-material/Image'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { Menu, MenuItem, ListItemIcon } from '@mui/material'
import { api, type User } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

export default function Profile() {
  const { user: ctxUser, refresh } = useAuth()
  const [u, setU] = useState<User | null>(ctxUser)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState<'avatar' | 'cover' | null>(null)
  const toast = useToast()
  const [avatarMenu, setAvatarMenu] = useState<HTMLElement | null>(null)
  const [confirmKind, setConfirmKind] = useState<'avatar' | 'cover' | null>(null)

  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.profile().then((p) => {
      setU(p); setDisplayName(p.displayName); setEmail(p.email)
    }).catch(console.error)
  }, [])

  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const fresh = await api.updateProfile(displayName, email)
      setU(fresh); toast.success('Profile updated.'); refresh()
    } catch (e) { toast.error(e) }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPass !== confirm) { toast.error('New password and confirmation do not match.'); return }
    try {
      await api.changePassword(current, newPass)
      toast.success('Password changed.'); setCurrent(''); setNewPass(''); setConfirm('')
    } catch (e) { toast.error(e) }
  }

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy('avatar')
    try {
      const fresh = await api.uploadAvatar(f); setU(fresh); toast.success('Avatar updated.'); refresh()
    } catch (e) { toast.error(e) }
    finally { setBusy(null); if (avatarInput.current) avatarInput.current.value = '' }
  }
  const doAvatarDelete = async () => {
    setBusy('avatar')
    try { const fresh = await api.deleteAvatar(); setU(fresh); toast.success('Avatar removed.'); refresh() }
    catch (e) { toast.error(e) }
    finally { setBusy(null); setConfirmKind(null) }
  }
  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy('cover')
    try {
      const fresh = await api.uploadCover(f); setU(fresh); toast.success('Cover updated.'); refresh()
    } catch (e) { toast.error(e) }
    finally { setBusy(null); if (coverInput.current) coverInput.current.value = '' }
  }
  const doCoverDelete = async () => {
    setBusy('cover')
    try { const fresh = await api.deleteCover(); setU(fresh); toast.success('Cover removed.'); refresh() }
    catch (e) { toast.error(e) }
    finally { setBusy(null); setConfirmKind(null) }
  }

  if (!u) return null
  const initial = (u.displayName || u.username)[0].toUpperCase()

  return (
    <Stack spacing={3}>
      {/* Hero card with cover + avatar */}
      <Card sx={{ overflow: 'hidden', position: 'relative' }}>
        <Box sx={{
          position: 'relative', width: '100%',
          height: { xs: 180, sm: 220, md: 260 },
          background: u.coverPath
            ? `url(${u.coverPath}) center/cover no-repeat, #1a1d22`
            : 'linear-gradient(135deg, #1c8bf2, #6fb8ff 50%, #5cc8b3)',
        }}>
          <Stack direction="row" spacing={1} sx={{
            position: 'absolute', top: 14, right: 14,
          }}>
            <Tooltip title={u.coverPath ? 'Change cover' : 'Add cover'}>
              <Button
                component="label" size="small" startIcon={<ImageIcon />}
                disabled={busy === 'cover'}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.92)', color: '#1a1d22',
                  textTransform: 'none', fontWeight: 600, fontSize: 12,
                  '&:hover': { bgcolor: '#fff' }, boxShadow: 2,
                }}>
                {u.coverPath ? 'Change cover' : 'Add cover'}
                <input ref={coverInput} hidden type="file" accept="image/*" onChange={onCoverFile} />
              </Button>
            </Tooltip>
            {u.coverPath && (
              <Tooltip title="Remove cover">
                <IconButton size="small" onClick={() => setConfirmKind('cover')} disabled={busy === 'cover'}
                  sx={{ bgcolor: 'rgba(255,255,255,0.92)', color: 'error.main', '&:hover': { bgcolor: 'error.main', color: '#fff' }, boxShadow: 2 }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <Box sx={{
          px: { xs: 2, md: 4 }, pb: { xs: 2, md: 3 },
          display: 'flex', alignItems: 'flex-end',
          gap: { xs: 2, md: 3 },
          mt: { xs: '-44px', md: '-56px' },
          flexWrap: 'wrap',
        }}>
          {/* Avatar with overlay edit button */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={u.avatarPath || undefined} sx={{
              width: { xs: 92, md: 124 }, height: { xs: 92, md: 124 },
              fontSize: { xs: 38, md: 48 }, fontWeight: 700,
              bgcolor: 'primary.main',
              border: '4px solid #fff', boxShadow: 4,
            }}>{initial}</Avatar>
            <Tooltip title={u.avatarPath ? 'Change avatar' : 'Upload avatar'}>
              <IconButton
                component="label" disabled={busy === 'avatar'}
                sx={{
                  position: 'absolute', bottom: 0, right: 0,
                  bgcolor: 'primary.main', color: '#fff',
                  border: '3px solid #fff', boxShadow: 2,
                  '&:hover': { bgcolor: 'primary.dark' },
                  width: 34, height: 34,
                }}>
                {u.avatarPath ? <EditIcon sx={{ fontSize: 16 }} /> : <PhotoCameraIcon sx={{ fontSize: 16 }} />}
                <input ref={avatarInput} hidden type="file" accept="image/*" onChange={onAvatarFile} />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, pb: 0.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word' }}>
                  {u.displayName || u.username}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.75, color: 'text.secondary', flexWrap: 'wrap', alignItems: 'center', rowGap: 0.5 }}>
                  <Chip size="small" label={u.role} color={u.role === 'admin' ? 'primary' : 'success'} />
                  <Typography sx={{ fontSize: 13 }}>@{u.username}</Typography>
                  {u.email && <Typography sx={{ fontSize: 13 }}>· {u.email}</Typography>}
                  <Typography sx={{ fontSize: 13 }}>· Joined {new Date(u.createdAt).toLocaleDateString()}</Typography>
                </Stack>
              </Box>
              {u.avatarPath && (
                <>
                  <Tooltip title="Avatar actions">
                    <IconButton size="small" onClick={(e) => setAvatarMenu(e.currentTarget)}>
                      <MoreVertIcon />
                    </IconButton>
                  </Tooltip>
                  <Menu anchorEl={avatarMenu} open={!!avatarMenu} onClose={() => setAvatarMenu(null)}>
                    <MenuItem component="label" onClick={() => setAvatarMenu(null)}>
                      <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                      Change avatar
                      <input hidden type="file" accept="image/*" onChange={onAvatarFile} />
                    </MenuItem>
                    <MenuItem onClick={() => { setAvatarMenu(null); setConfirmKind('avatar') }} sx={{ color: 'error.main' }}>
                      <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                      Remove avatar
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Stack>
          </Box>
        </Box>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Account info</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 2 }}>
                Your public identity on the site.
              </Typography>
              <form onSubmit={saveInfo}>
                <Stack spacing={2}>
                  <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth />
                  <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                  <TextField label="Username" value={u.username} disabled fullWidth />
                  <Divider />
                  <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-end' }}>Save changes</Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Password</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 2 }}>
                Use a phrase you can remember.
              </Typography>
              <form onSubmit={savePassword}>
                <Stack spacing={2}>
                  <TextField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required fullWidth autoComplete="current-password" />
                  <TextField label="New password" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required fullWidth autoComplete="new-password" />
                  <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required fullWidth autoComplete="new-password" />
                  <Divider />
                  <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-end' }}>Update password</Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog
        open={confirmKind !== null}
        onClose={() => busy === null && setConfirmKind(null)}
        maxWidth="xs" fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Remove {confirmKind === 'avatar' ? 'avatar' : 'cover'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmKind === 'avatar'
              ? 'This will permanently delete your avatar image. You can upload a new one anytime.'
              : 'This will permanently delete your cover image. You can upload a new one anytime.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmKind(null)} disabled={busy !== null}>
            Cancel
          </Button>
          <Button
            color="error" variant="contained" startIcon={<DeleteIcon />}
            disabled={busy !== null}
            onClick={confirmKind === 'avatar' ? doAvatarDelete : doCoverDelete}
            autoFocus
          >
            {busy !== null ? 'Removing…' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
