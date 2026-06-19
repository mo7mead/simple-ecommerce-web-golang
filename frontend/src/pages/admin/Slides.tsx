import { useEffect, useRef, useState } from 'react'
import {
  Skeleton, Stack, Avatar, ToggleButton, ToggleButtonGroup, Paper, Table,
  TableBody, TableCell, TableHead, TableRow, Typography, IconButton, Tooltip, Box,
} from '@mui/material'
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined'
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import { api, type Slide } from '../../api'
import { useToast } from '../../Toast'

type View = 'grid' | 'list'

export default function AdminSlides() {
  const [slides, setSlides] = useState<Slide[] | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()
  const [dragActive, setDragActive] = useState(false)
  const [view, setView] = useState<View>('grid')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => api.adminSlides().then(s => setSlides(s || [])).catch(console.error)
  useEffect(() => { load() }, [])

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !file) { toast.error('Title and image are required.'); return }
    setUploading(true)
    try {
      await api.adminSlideUpload(title.trim(), body.trim(), file)
      toast.success('Slide published.')
      setTitle(''); setBody(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (e) { toast.error(e) } finally { setUploading(false) }
  }

  const onDelete = async (id: number) => {
    if (!confirm('Delete this slide?')) return
    try {
      await api.adminSlideDelete(id)
      toast.success('Slide deleted.')
      await load()
    } catch (e) { toast.error(e) }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) setFile(f)
  }

  const previewUrl = file ? URL.createObjectURL(file) : null

  return (
    <Stack spacing={3}>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl
                          bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-md ring-1 ring-white/20">
            <CollectionsOutlinedIcon sx={{ fontSize: 20 }} />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Home slides</h1>
            <p className="text-[13px] text-slate-500">
              Hero carousel shown to every visitor on the home page.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold
                        text-slate-700 ring-1 ring-slate-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {slides ? `${slides.length} live slide${slides.length === 1 ? '' : 's'}` : 'Loading…'}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Create form */}
        <div className="lg:col-span-4">
          <div className="sticky top-3 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <RocketLaunchOutlinedIcon sx={{ fontSize: 14 }} />
                New slide
              </div>
              <h2 className="mt-0.5 text-[16px] font-bold text-slate-900">Publish to home page</h2>
            </div>
            <form onSubmit={onUpload} className="space-y-4 p-5">
              {/* Drop zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed
                            transition
                            ${dragActive
                              ? 'border-indigo-400 bg-indigo-50/60'
                              : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
                            }`}
                style={{ aspectRatio: '16/9' }}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        if (fileRef.current) fileRef.current.value = ''
                      }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold
                                 text-white backdrop-blur transition hover:bg-rose-600"
                    >
                      Replace
                    </button>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-500
                                  transition group-hover:text-indigo-600">
                    <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 32 }} />
                    <p className="text-[13px] font-semibold">Drop image or click to choose</p>
                    <p className="text-[11px] text-slate-400">16:9 recommended · JPG / PNG / WEBP</p>
                  </div>
                )}
                <input
                  ref={fileRef} hidden type="file" accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-600">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Summer collection 2026"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]
                             text-slate-900 placeholder:text-slate-400
                             focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-600">
                  Body <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Short call-to-action shown under the title."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]
                             text-slate-900 placeholder:text-slate-400
                             focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg
                           bg-gradient-to-br from-indigo-500 to-violet-600 px-3 py-2.5 text-[14px] font-semibold
                           text-white shadow-sm transition hover:shadow-md hover:brightness-110
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <CloudUploadOutlinedIcon sx={{ fontSize: 18 }} />
                {uploading ? 'Publishing…' : 'Publish slide'}
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-8">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold text-slate-900">Active carousel</h2>
            <div className="flex items-center gap-3">
              <span className="text-[11.5px] uppercase tracking-wider text-slate-400">
                Order = position on home
              </span>
              <ToggleButtonGroup value={view} exclusive size="small"
                onChange={(_, v: View | null) => v && setView(v)}>
                <ToggleButton value="grid"><GridViewRoundedIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="list"><ViewListRoundedIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </div>
          </div>

          {!slides ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={240} className="!rounded-2xl" />
              ))}
            </div>
          ) : slides.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white
                            px-6 py-16 text-center ring-1 ring-slate-200/70">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CollectionsOutlinedIcon sx={{ fontSize: 24 }} />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">No slides yet</p>
              <p className="text-[12.5px] text-slate-500">Upload your first hero image with the form on the left.</p>
            </div>
          ) : view === 'list' ? (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 50 }}>#</TableCell>
                    <TableCell sx={{ width: 80 }}></TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Body</TableCell>
                    <TableCell align="right">Added</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slides.map((s, idx) => (
                    <TableRow key={s.ID} hover>
                      <TableCell>
                        <Box sx={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: 1.5,
                          bgcolor: 'rgba(99,102,241,0.1)', color: '#4f46e5',
                          fontWeight: 700, fontSize: 12,
                        }}>{idx + 1}</Box>
                      </TableCell>
                      <TableCell>
                        <Avatar variant="rounded" src={s.ImagePath} alt={s.Title}
                          sx={{ width: 64, height: 36 }} />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>{s.Title}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace' }}>
                          ID {s.ID}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography sx={{
                          fontSize: 13, color: 'text.secondary',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>{s.Body || '—'}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {new Date(s.CreatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => onDelete(s.ID)}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'rgba(239,68,68,0.08)' } }}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3 sm:grid-cols-2">
              {slides.map((s, idx) => (
                <li
                  key={s.ID}
                  className="group relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm
                             transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <img
                      src={s.ImagePath}
                      alt={s.Title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full
                                    bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                      <span className="font-bold">#{idx + 1}</span>
                      <span className="opacity-70">·</span>
                      <span className="font-mono opacity-80">ID {s.ID}</span>
                    </div>
                    <button
                      onClick={() => onDelete(s.ID)}
                      aria-label="Delete slide"
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full
                                 bg-black/60 text-white opacity-0 transition group-hover:opacity-100
                                 hover:bg-rose-600 hover:scale-110 backdrop-blur"
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                    </button>
                  </div>
                  <div className="space-y-1 p-3">
                    <h3 className="line-clamp-1 text-[14px] font-bold text-slate-900">{s.Title}</h3>
                    {s.Body && <p className="line-clamp-2 text-[12.5px] text-slate-500">{s.Body}</p>}
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-400">
                      <Avatar
                        sx={{
                          width: 16, height: 16, fontSize: 10, fontWeight: 700,
                          bgcolor: 'rgba(99,102,241,0.12)', color: '#4f46e5',
                        }}
                      >A</Avatar>
                      Added {new Date(s.CreatedAt).toLocaleDateString([], {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Stack>
  )
}
