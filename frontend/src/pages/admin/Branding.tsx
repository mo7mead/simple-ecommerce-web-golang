import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Box, Grid,
  Avatar, Paper, Chip, Slider, ToggleButton, ToggleButtonGroup,
  Tooltip, IconButton, Divider, LinearProgress, MenuItem,
} from '@mui/material'
import { useToast } from '../../components/Toast'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined'
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined'
import ColorLensOutlinedIcon from '@mui/icons-material/ColorLensOutlined'
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import { api } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

const PRESETS = ['#4ea1ff', '#1c8bf2', '#7c4ddb', '#1f9e4f', '#e07b1c', '#d6336c', '#0f4c3a', '#0ea5e9']

type Fmt = 'auto' | 'webp' | 'png' | 'jpeg'
type Bg = 'transparent' | 'white' | 'black'

interface Analysis {
  width: number
  height: number
  type: string
  size: number
  dominant: string[]   // hex colors
  hasAlpha: boolean
  aspect: string       // e.g. "4 : 1"
}

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

const aspectStr = (w: number, h: number) => {
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a
  const g = gcd(w, h) || 1
  return `${w / g} : ${h / g}`
}

const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

function extractDominant(img: HTMLImageElement): { colors: string[]; hasAlpha: boolean } {
  // Downsample to keep this cheap.
  const w = Math.min(img.naturalWidth, 64)
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w))
  const cvs = document.createElement('canvas')
  cvs.width = w; cvs.height = h
  const ctx = cvs.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()
  let hasAlpha = false
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 250) { hasAlpha = true; if (a < 32) continue }
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const key = `${r >> 5}|${g >> 5}|${b >> 5}` // 8x8x8 buckets
    const c = buckets.get(key)
    if (c) { c.r += r; c.g += g; c.b += b; c.n += 1 }
    else buckets.set(key, { r, g, b, n: 1 })
  }
  const arr = [...buckets.values()]
    .map(c => ({ r: Math.round(c.r / c.n), g: Math.round(c.g / c.n), b: Math.round(c.b / c.n), n: c.n }))
    .filter(c => {
      // Skip near-greys for a more interesting palette, unless image is mostly grey.
      const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b)
      return max - min > 12 || (max > 240 || max < 40)
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map(c => rgbToHex(c.r, c.g, c.b))
  return { colors: arr, hasAlpha }
}

export default function AdminBranding() {
  const { refresh } = useAuth()
  const toast = useToast()
  const [siteName, setSiteName] = useState('')
  const [tagline, setTagline] = useState('')
  const [accent, setAccent] = useState('#4ea1ff')
  const [logoPath, setLogoPath] = useState('')
  const [busy, setBusy] = useState(false)

  // Editor state
  const [origFile, setOrigFile] = useState<File | null>(null)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [maxWidth, setMaxWidth] = useState(512)
  const [fmt, setFmt] = useState<Fmt>('auto')
  const [quality, setQuality] = useState(0.9)
  const [bg, setBg] = useState<Bg>('transparent')
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [outputDims, setOutputDims] = useState<{ w: number; h: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.adminBrandingGet().then(s => {
      setSiteName(s.siteName); setTagline(s.tagline)
      setAccent(s.accentColor || '#4ea1ff'); setLogoPath(s.logoPath)
    })
  }, [])

  // Cleanup blob URL.
  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl) }, [outputUrl])

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image.'); return
    }
    setOrigFile(file)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const { colors, hasAlpha } = extractDominant(img)
      setImgEl(img)
      setAnalysis({
        width: img.naturalWidth,
        height: img.naturalHeight,
        type: file.type || 'image/unknown',
        size: file.size,
        dominant: colors,
        hasAlpha,
        aspect: aspectStr(img.naturalWidth, img.naturalHeight),
      })
      // Smart defaults.
      setMaxWidth(Math.min(img.naturalWidth, 512))
      setFmt('auto')
      setBg(hasAlpha ? 'transparent' : 'white')
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      toast.error('Could not decode that image.')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [toast])

  const resolvedFmt = useMemo<Exclude<Fmt, 'auto'>>(() => {
    if (fmt !== 'auto') return fmt
    if (!analysis) return 'webp'
    // Auto: prefer WEBP everywhere (best size/quality); use PNG when alpha must be preserved without WEBP fallback.
    return 'webp'
  }, [fmt, analysis])

  const mime = `image/${resolvedFmt}`
  const lossy = resolvedFmt === 'webp' || resolvedFmt === 'jpeg'

  // Re-encode whenever the editor knobs change.
  useEffect(() => {
    if (!imgEl || !analysis) return
    const target = Math.max(16, Math.min(maxWidth, analysis.width))
    const scale = target / analysis.width
    const w = Math.round(analysis.width * scale)
    const h = Math.round(analysis.height * scale)
    const cvs = document.createElement('canvas')
    cvs.width = w; cvs.height = h
    const ctx = cvs.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    if (resolvedFmt === 'jpeg' || bg !== 'transparent') {
      ctx.fillStyle = resolvedFmt === 'jpeg' && bg === 'transparent' ? '#ffffff' : (bg === 'black' ? '#000000' : '#ffffff')
      if (resolvedFmt !== 'jpeg' && bg === 'transparent') {
        // skip fill
      } else {
        ctx.fillRect(0, 0, w, h)
      }
    }
    ctx.drawImage(imgEl, 0, 0, w, h)
    cvs.toBlob(blob => {
      if (!blob) return
      setOutputDims({ w, h })
      setOutputBlob(blob)
      setOutputUrl(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
    }, mime, lossy ? quality : undefined)
  }, [imgEl, analysis, maxWidth, resolvedFmt, quality, bg, mime, lossy])

  const onSave = async (e?: React.FormEvent) => {
    e?.preventDefault(); setBusy(true)
    try {
      let upload: File | null = null
      if (outputBlob && origFile) {
        const baseName = origFile.name.replace(/\.[^.]+$/, '')
        const ext = resolvedFmt === 'jpeg' ? 'jpg' : resolvedFmt
        upload = new File([outputBlob], `${baseName}.${ext}`, { type: mime })
      }
      const s = await api.adminBrandingSave(siteName, tagline, accent, upload)
      setLogoPath(s.logoPath)
      resetEditor()
      toast.success('Branding saved.')
      refresh()
    } catch (e) { toast.error(e) } finally { setBusy(false) }
  }

  const resetEditor = () => {
    setOrigFile(null); setImgEl(null); setAnalysis(null)
    setOutputBlob(null)
    setOutputUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setOutputDims(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onRemoveLogo = async () => {
    if (!confirm('Remove logo?')) return
    await api.adminLogoDelete(); setLogoPath(''); refresh()
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) loadFile(f)
  }

  const previewLogo = outputUrl || logoPath || ''
  const sizeDelta = analysis && outputBlob
    ? Math.round(((analysis.size - outputBlob.size) / analysis.size) * 100)
    : 0

  return (
    <Stack spacing={2.5}>
      {/* Hero */}
      <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 3,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 45%, #831843 100%)',
        color: '#fff', p: { xs: 2.5, md: 3.5 },
      }}>
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.22,
          background: 'radial-gradient(circle at 85% 15%, rgba(244,114,182,0.55), transparent 45%), radial-gradient(circle at 10% 90%, rgba(99,102,241,0.5), transparent 50%)',
        }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          sx={{ position: 'relative', alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 2,
              background: 'linear-gradient(135deg, #f472b6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px -8px rgba(99,102,241,0.6)',
            }}>
              <BrushOutlinedIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Branding
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, mt: 0.5 }}>
                Identity, accent color, and a logo studio that resizes & re-encodes to optimal quality.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <StatPill label="Logo" value={logoPath ? 'Set' : 'None'} accent={logoPath ? '#22c55e' : 'rgba(255,255,255,0.6)'} />
            <StatPill label="Accent" value={accent} accent={accent} mono />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {/* Identity + Logo editor */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                <ColorLensOutlinedIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Identity</Typography>
              </Stack>
              <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 2 }}>
                Shown in the navbar, tab title, and footer.
              </Typography>

              <form onSubmit={onSave}>
                <Stack spacing={2}>
                  <TextField label="Site name" size="small" value={siteName}
                    onChange={e => setSiteName(e.target.value)} required fullWidth />
                  <TextField label="Tagline" size="small" value={tagline}
                    onChange={e => setTagline(e.target.value)} fullWidth />

                  {/* Accent color */}
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>Accent color</Typography>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Box component="input" type="color" value={accent}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccent(e.target.value)}
                        sx={{
                          width: 44, height: 44, p: 0, cursor: 'pointer',
                          border: '1px solid', borderColor: 'divider', borderRadius: 2,
                        }} />
                      <TextField size="small" value={accent}
                        onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setAccent(e.target.value)}
                        sx={{ width: 120 }}
                        slotProps={{ input: { sx: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } } }} />
                      {PRESETS.map(c => (
                        <Tooltip key={c} title={c}>
                          <Box component="button" type="button" onClick={() => setAccent(c)}
                            sx={{
                              width: 26, height: 26, borderRadius: '50%', p: 0, cursor: 'pointer',
                              border: '2px solid #fff', boxShadow: 1, bgcolor: c,
                              outline: accent.toLowerCase() === c.toLowerCase() ? '2px solid' : 'none',
                              outlineColor: 'primary.main', outlineOffset: 2,
                            }} />
                        </Tooltip>
                      ))}
                    </Stack>
                  </Box>

                  <Divider />

                  {/* Logo studio */}
                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                      <AutoFixHighOutlinedIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Logo studio</Typography>
                      <Chip size="small" label="Analyze · Resize · Re-encode"
                        sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: 'rgba(124,58,237,0.1)', color: '#6d28d9' }} />
                    </Stack>

                    {!imgEl && (
                      <Box
                        onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={onDrop}
                        onClick={() => fileRef.current?.click()}
                        sx={{
                          aspectRatio: '4/1', borderRadius: 2,
                          border: '2px dashed', borderColor: dragActive ? 'primary.main' : 'divider',
                          bgcolor: dragActive ? 'rgba(99,102,241,0.05)' : '#f8fafc',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all .15s',
                          '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(99,102,241,0.04)' },
                        }}>
                        <Stack spacing={0.5} sx={{ color: 'text.secondary', alignItems: 'center' }}>
                          <CloudUploadIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                            Drop a logo or click to choose
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                            PNG / SVG transparent recommended · JPG / WEBP supported
                          </Typography>
                        </Stack>
                        <input ref={fileRef} hidden type="file" accept="image/*"
                          onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
                      </Box>
                    )}

                    {imgEl && analysis && (
                      <Stack spacing={2}>
                        {/* Live preview surfaces */}
                        <Grid container spacing={1.5}>
                          <Grid size={6}>
                            <PreviewSurface label="Light" bg="#ffffff" src={outputUrl} />
                          </Grid>
                          <Grid size={6}>
                            <PreviewSurface label="Dark" bg="#0f172a" src={outputUrl} />
                          </Grid>
                        </Grid>

                        {/* Analysis chips */}
                        <Box sx={{
                          p: 1.5, borderRadius: 2,
                          bgcolor: 'rgba(99,102,241,0.05)',
                          border: '1px solid', borderColor: 'rgba(99,102,241,0.15)',
                        }}>
                          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
                            <InsightsOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Source analysis
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                            <DataChip label="Dimensions" value={`${analysis.width} × ${analysis.height}`} />
                            <DataChip label="Aspect" value={analysis.aspect} />
                            <DataChip label="Size" value={fmtBytes(analysis.size)} />
                            <DataChip label="Type" value={analysis.type.replace('image/', '').toUpperCase()} />
                            <DataChip label="Alpha" value={analysis.hasAlpha ? 'Yes' : 'No'}
                              color={analysis.hasAlpha ? '#16a34a' : 'text.secondary'} />
                          </Stack>
                          {analysis.dominant.length > 0 && (
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>Dominant:</Typography>
                              {analysis.dominant.map(c => (
                                <Tooltip key={c} title={`Use ${c} as accent`}>
                                  <Box component="button" type="button" onClick={() => setAccent(c)}
                                    sx={{
                                      width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                                      bgcolor: c, border: '2px solid #fff', boxShadow: 1, p: 0,
                                      outline: accent.toLowerCase() === c.toLowerCase() ? '2px solid' : 'none',
                                      outlineColor: 'primary.main', outlineOffset: 1,
                                    }} />
                                </Tooltip>
                              ))}
                            </Stack>
                          )}
                        </Box>

                        {/* Resize */}
                        <Box>
                          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Max width</Typography>
                            <Chip size="small" label={`${maxWidth}px`} sx={{ height: 20, fontWeight: 700, fontFamily: 'monospace' }} />
                          </Stack>
                          <Slider value={maxWidth} min={64} max={Math.max(analysis.width, 1024)} step={8}
                            onChange={(_, v) => setMaxWidth(v as number)}
                            valueLabelDisplay="auto"
                            marks={[
                              { value: 128, label: 'S' },
                              { value: 256, label: 'M' },
                              { value: 512, label: 'L' },
                              { value: 1024, label: 'XL' },
                            ]} />
                        </Box>

                        {/* Format + BG */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Format</Typography>
                            <ToggleButtonGroup value={fmt} exclusive size="small" fullWidth
                              onChange={(_, v: Fmt | null) => v && setFmt(v)}>
                              <ToggleButton value="auto" sx={{ textTransform: 'none', fontWeight: 600 }}>Auto</ToggleButton>
                              <ToggleButton value="webp" sx={{ textTransform: 'none', fontWeight: 600 }}>WEBP</ToggleButton>
                              <ToggleButton value="png" sx={{ textTransform: 'none', fontWeight: 600 }}>PNG</ToggleButton>
                              <ToggleButton value="jpeg" sx={{ textTransform: 'none', fontWeight: 600 }}>JPEG</ToggleButton>
                            </ToggleButtonGroup>
                          </Box>
                          <Box sx={{ minWidth: { sm: 150 } }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Background</Typography>
                            <TextField select size="small" fullWidth value={bg} onChange={e => setBg(e.target.value as Bg)}>
                              <MenuItem value="transparent" disabled={resolvedFmt === 'jpeg'}>Transparent</MenuItem>
                              <MenuItem value="white">White</MenuItem>
                              <MenuItem value="black">Black</MenuItem>
                            </TextField>
                          </Box>
                        </Stack>

                        {/* Quality */}
                        {lossy && (
                          <Box>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Quality</Typography>
                              <Chip size="small" label={`${Math.round(quality * 100)}%`}
                                sx={{ height: 20, fontWeight: 700, fontFamily: 'monospace' }} />
                            </Stack>
                            <Slider value={quality} min={0.4} max={1} step={0.05}
                              onChange={(_, v) => setQuality(v as number)} />
                          </Box>
                        )}

                        {/* Output summary */}
                        {outputBlob && outputDims && (
                          <Paper variant="outlined" sx={{
                            p: 1.5, borderRadius: 2,
                            background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(16,185,129,0.08))',
                            borderColor: 'rgba(34,197,94,0.25)',
                          }}>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
                              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Output
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                              <DataChip label="Dimensions" value={`${outputDims.w} × ${outputDims.h}`} />
                              <DataChip label="Size" value={fmtBytes(outputBlob.size)} />
                              <DataChip label="Format" value={resolvedFmt.toUpperCase()} />
                              {sizeDelta > 0 ? (
                                <Chip size="small" label={`−${sizeDelta}% smaller`}
                                  sx={{ height: 22, fontSize: 11, fontWeight: 700, color: '#fff',
                                    background: 'linear-gradient(135deg, #16a34a, #059669)' }} />
                              ) : sizeDelta < 0 ? (
                                <Chip size="small" label={`+${Math.abs(sizeDelta)}% larger`}
                                  sx={{ height: 22, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: 'warning.main' }} />
                              ) : null}
                            </Stack>
                          </Paper>
                        )}

                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <Button size="small" startIcon={<SettingsBackupRestoreIcon />} onClick={resetEditor}
                            sx={{ textTransform: 'none', color: 'text.secondary' }}>
                            Discard
                          </Button>
                          <Button component="label" size="small" sx={{ textTransform: 'none' }}>
                            Replace file
                            <input hidden type="file" accept="image/*"
                              onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} />
                          </Button>
                        </Stack>
                      </Stack>
                    )}

                    {/* Current saved logo */}
                    {!imgEl && logoPath && (
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, p: 1.5, mt: 1.5,
                        bgcolor: '#0f172a', borderRadius: 2 }}>
                        <Box component="img" src={logoPath} alt="" sx={{ maxHeight: 36, maxWidth: 180 }} />
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Current saved logo</Typography>
                        <Tooltip title="Remove logo">
                          <IconButton size="small" onClick={onRemoveLogo}
                            sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#f87171' } }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Box>

                  <Divider />

                  <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                    <Button type="submit" variant="contained" size="large" disabled={busy}
                      sx={{
                        textTransform: 'none', fontWeight: 700, px: 3,
                        background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                        '&:hover': { background: 'linear-gradient(135deg, #818cf8, #f472b6)' },
                      }}>
                      {busy ? 'Saving…' : (outputBlob ? 'Save & publish logo' : 'Save branding')}
                    </Button>
                  </Stack>
                  {busy && <LinearProgress sx={{ borderRadius: 2 }} />}
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Live preview */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2} sx={{ position: { md: 'sticky' }, top: 0 }}>
            <Card sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Box sx={{ background: 'linear-gradient(180deg, #0f172a, #020617)', p: 2.5 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                  {previewLogo ? (
                    <Box component="img" src={previewLogo} sx={{ maxHeight: 36, maxWidth: 180 }} />
                  ) : (
                    <Avatar sx={{
                      width: 36, height: 36, bgcolor: accent,
                      fontSize: 15, fontWeight: 800,
                    }}>
                      {(siteName[0] || '?').toUpperCase()}
                    </Avatar>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.1 }} noWrap>
                      {siteName || 'Your site'}
                    </Typography>
                    {tagline && (
                      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} noWrap>
                        {tagline}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
              <CardContent sx={{ p: 2.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.25 }}>
                  Sample components
                </Typography>
                <Stack spacing={1.5}>
                  <Button variant="contained"
                    sx={{
                      bgcolor: accent, textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start',
                      '&:hover': { bgcolor: accent, filter: 'brightness(1.1)' },
                    }}>
                    Primary button
                  </Button>
                  <Box component="a" href="#" onClick={(e: React.MouseEvent) => e.preventDefault()}
                    sx={{ color: accent, fontWeight: 600, textDecoration: 'underline', fontSize: 14, alignSelf: 'flex-start' }}>
                    A sample link
                  </Box>
                  <Chip label="Active filter"
                    sx={{ bgcolor: `${accent}22`, color: accent, fontWeight: 700, alignSelf: 'flex-start' }} />
                  <Paper variant="outlined" sx={{ p: 1.5, borderColor: accent, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ width: 6, height: 32, bgcolor: accent, borderRadius: 1 }} />
                      <Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Tinted callout</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Adopts the accent border.</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
                  Tips
                </Typography>
                <Stack spacing={0.75}>
                  <TipRow text="Use a transparent PNG or SVG so the logo sits cleanly on dark and light surfaces." />
                  <TipRow text="WEBP usually gives the smallest file at the same visual quality." />
                  <TipRow text="200–400 px wide is enough for navbars at 2× DPI." />
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  )
}

function StatPill({ label, value, accent, mono }: { label: string; value: string; accent: string; mono?: boolean }) {
  return (
    <Box sx={{
      px: 1.75, py: 1, borderRadius: 2,
      bgcolor: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      minWidth: 96, textAlign: 'center',
      backdropFilter: 'blur(6px)',
    }}>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1.2,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
      }}>
        {value}
      </Typography>
    </Box>
  )
}

function DataChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.5, borderRadius: 1.25,
      bgcolor: '#fff', border: '1px solid', borderColor: 'rgba(15,23,42,0.08)',
      fontSize: 11,
    }}>
      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>{label}</Box>
      <Box component="span" sx={{ color: color || 'text.primary', fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        {value}
      </Box>
    </Box>
  )
}

function PreviewSurface({ label, bg, src }: { label: string; bg: string; src: string | null }) {
  return (
    <Box sx={{
      position: 'relative', borderRadius: 2, overflow: 'hidden',
      border: '1px solid', borderColor: 'divider',
      bgcolor: bg, aspectRatio: '4/1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: bg === '#ffffff'
        ? 'linear-gradient(45deg,#f3f4f6 25%,transparent 25%),linear-gradient(-45deg,#f3f4f6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f3f4f6 75%),linear-gradient(-45deg,transparent 75%,#f3f4f6 75%)'
        : undefined,
      backgroundSize: bg === '#ffffff' ? '12px 12px' : undefined,
      backgroundPosition: bg === '#ffffff' ? '0 0,0 6px,6px -6px,-6px 0' : undefined,
    }}>
      {src && <Box component="img" src={src} sx={{ maxHeight: '80%', maxWidth: '85%', objectFit: 'contain', position: 'relative', zIndex: 1 }} />}
      <Chip label={label} size="small" sx={{
        position: 'absolute', top: 4, left: 4, height: 18, fontSize: 10, fontWeight: 700,
        bgcolor: bg === '#ffffff' ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.15)',
        color: '#fff', backdropFilter: 'blur(6px)',
      }} />
    </Box>
  )
}

function TipRow({ text }: { text: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ mt: 0.5, width: 6, height: 6, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #ec4899)', flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.45 }}>{text}</Typography>
    </Stack>
  )
}

