import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Box, Alert, AlertTitle, IconButton, Slide } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

type Severity = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  severity: Severity
  title?: string
  message: string
}

interface ToastOpts {
  title?: string
  /** Override auto-dismiss delay in ms. Defaults: error=6000, others=3500. */
  duration?: number
}

interface ToastApi {
  show(severity: Severity, message: string, opts?: ToastOpts): void
  success(message: string, opts?: ToastOpts): void
  error(message: string | Error | unknown, opts?: ToastOpts): void
  info(message: string, opts?: ToastOpts): void
  warning(message: string, opts?: ToastOpts): void
  dismiss(id: number): void
}

const ToastCtx = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const v = useContext(ToastCtx)
  if (!v) throw new Error('useToast must be used inside <ToastProvider>')
  return v
}

const MAX = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(1)
  const timers = useRef<Map<number, number>>(new Map())

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id))
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
  }, [])

  const show = useCallback((severity: Severity, message: string, opts?: ToastOpts) => {
    const id = idRef.current++
    const duration = opts?.duration ?? (severity === 'error' ? 6000 : 3500)
    setItems(prev => [...prev.slice(-(MAX - 1)), { id, severity, message, title: opts?.title }])
    const handle = window.setTimeout(() => dismiss(id), duration)
    timers.current.set(id, handle)
  }, [dismiss])

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m, o) => show('success', m, o),
    info: (m, o) => show('info', m, o),
    warning: (m, o) => show('warning', m, o),
    error: (m, o) => show('error', toErrorMessage(m), o),
    dismiss,
  }), [show, dismiss])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <Box
        aria-live="polite"
        sx={{
          position: 'fixed',
          top: { xs: 12, sm: 16 },
          right: { xs: 12, sm: 16 },
          zIndex: (t) => t.zIndex.snackbar + 10,
          display: 'flex', flexDirection: 'column', gap: 1,
          pointerEvents: 'none',
          width: { xs: 'calc(100% - 24px)', sm: 360 },
          maxWidth: '100%',
        }}>
        {items.map((t) => (
          <Slide key={t.id} in direction="left" mountOnEnter unmountOnExit>
            <Alert
              severity={t.severity}
              variant="filled"
              elevation={6}
              onClose={() => dismiss(t.id)}
              action={
                <IconButton size="small" onClick={() => dismiss(t.id)} sx={{ color: 'inherit' }}>
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
              sx={{
                pointerEvents: 'auto',
                borderRadius: 2,
                alignItems: 'flex-start',
                boxShadow: '0 10px 30px -10px rgba(15,23,42,0.35)',
                '& .MuiAlert-message': { flex: 1, fontSize: 13.5, fontWeight: 500 },
              }}>
              {t.title && <AlertTitle sx={{ fontSize: 13, fontWeight: 700, mb: 0.25 }}>{t.title}</AlertTitle>}
              {t.message}
            </Alert>
          </Slide>
        ))}
      </Box>
    </ToastCtx.Provider>
  )
}

function toErrorMessage(v: unknown): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.message
  if (v && typeof v === 'object' && 'message' in v) return String((v as { message: unknown }).message)
  return 'Something went wrong.'
}
