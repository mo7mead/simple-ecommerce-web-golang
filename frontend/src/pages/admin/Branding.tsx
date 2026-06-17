import { useEffect, useRef, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid,
  Alert, Avatar,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import { api } from '../../api'
import { useAuth } from '../../AuthContext'

const PRESETS = ['#4ea1ff', '#1c8bf2', '#7c4ddb', '#1f9e4f', '#e07b1c', '#d6336c', '#0f4c3a']

export default function AdminBranding() {
  const { refresh } = useAuth()
  const [siteName, setSiteName] = useState('')
  const [tagline, setTagline] = useState('')
  const [accent, setAccent] = useState('#4ea1ff')
  const [logoPath, setLogoPath] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.adminBrandingGet().then(s => {
      setSiteName(s.siteName); setTagline(s.tagline)
      setAccent(s.accentColor || '#4ea1ff'); setLogoPath(s.logoPath)
    })
  }, [])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setSaved(false)
    try {
      const s = await api.adminBrandingSave(siteName, tagline, accent, logoFile)
      setLogoPath(s.logoPath); setLogoFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setSaved(true); refresh()
    } catch (e) { setErr((e as Error).message) }
  }
  const onRemoveLogo = async () => {
    if (!confirm('Remove logo?')) return
    await api.adminLogoDelete(); setLogoPath(''); refresh()
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Branding</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Identity</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 2 }}>Shown in navbar, tab title, and footer.</Typography>
              <form onSubmit={onSave}>
                <Stack spacing={2}>
                  {saved && <Alert severity="success">Saved.</Alert>}
                  {err && <Alert severity="error">{err}</Alert>}
                  <TextField label="Site name" value={siteName} onChange={e => setSiteName(e.target.value)} required fullWidth />
                  <TextField label="Tagline" value={tagline} onChange={e => setTagline(e.target.value)} fullWidth />
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>Accent color</Typography>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Box component="input" type="color" value={accent} onChange={(e: any) => setAccent(e.target.value)}
                        sx={{ width: 44, height: 44, padding: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, cursor: 'pointer' }} />
                      <TextField size="small" value={accent} disabled sx={{ width: 110 }} slotProps={{ input: { sx: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } } }} />
                      {PRESETS.map(c => (
                        <Box key={c} component="button" type="button" onClick={() => setAccent(c)}
                          sx={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', boxShadow: 1, cursor: 'pointer', p: 0, bgcolor: c }} />
                      ))}
                    </Stack>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>Logo</Typography>
                    {logoPath && (
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: '#1a1d22', borderRadius: 1, mb: 1 }}>
                        <Box component="img" src={logoPath} sx={{ maxHeight: 32, maxWidth: 160 }} />
                        <Box sx={{ flex: 1 }} />
                        <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onRemoveLogo}>Remove</Button>
                      </Stack>
                    )}
                    <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
                      {logoFile ? logoFile.name : 'Choose a new logo'}
                      <input ref={fileRef} hidden type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                    </Button>
                  </Box>
                  <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-end' }}>Save branding</Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ position: { md: 'sticky' }, top: 0 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Preview</Typography>
              <Box sx={{ background: 'linear-gradient(180deg, #1a1d22, #14171c)', p: 2, borderRadius: 1.5, mb: 2 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                  {logoPath ? (
                    <Box component="img" src={logoPath} sx={{ maxHeight: 28 }} />
                  ) : (
                    <Avatar sx={{ width: 30, height: 30, bgcolor: accent, fontSize: 13, fontWeight: 700 }}>
                      {(siteName[0] || '?').toUpperCase()}
                    </Avatar>
                  )}
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>{siteName}</Typography>
                    {tagline && <Typography sx={{ color: '#9aa0a6', fontSize: 11 }}>{tagline}</Typography>}
                  </Box>
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" sx={{ bgcolor: accent, '&:hover': { bgcolor: accent } }}>Primary</Button>
                <Box component="a" href="#" sx={{ color: accent, fontWeight: 600, alignSelf: 'center' }}>A sample link</Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}
