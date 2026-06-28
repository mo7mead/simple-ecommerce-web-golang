import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import {
  Typography, Stack, Card, CardContent, Chip, Button, Box, Divider, Paper,
  ToggleButton, ToggleButtonGroup, IconButton, Tooltip, LinearProgress, Grid,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import PersonOutlineIcon from '@mui/icons-material/Person'
import PhoneOutlinedIcon from '@mui/icons-material/Phone'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import PrintOutlinedIcon from '@mui/icons-material/Print'
import { api, type Order } from '../../api'
import { useToast } from '../../components/Toast'

const STATUSES: Order['status'][] = ['pending', 'shipped', 'delivered', 'cancelled']

const STATUS_HEX: Record<Order['status'], string> = {
  pending: '#f59e0b', shipped: '#3b82f6', delivered: '#10b981', cancelled: '#ef4444',
}

export default function AdminOrderDetail() {
  const { ref } = useParams<{ ref: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const toast = useToast()
  const nav = useNavigate()

  const load = () => {
    if (!ref) return
    setNotFound(false)
    api.adminOrder(ref).then(setOrder).catch(err => {
      console.error(err)
      setNotFound(true)
    })
  }
  useEffect(load, [ref])

  if (notFound) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => nav('/admin/orders')} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
          Back to orders
        </Button>
        <Card sx={{ borderRadius: 2.5 }}>
          <CardContent sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Order not found</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>
              No order with ref <code>{ref}</code>.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    )
  }

  if (!order) return <LinearProgress />

  const setStatus = async (status: Order['status']) => {
    setBusy(true)
    try {
      await api.adminOrderStatus(order.id, status)
      toast.success(`Status → ${status}`)
      load()
    } catch (e) { toast.error(e) } finally { setBusy(false) }
  }

  const copyRef = () => {
    navigator.clipboard.writeText(order.ref).then(() => toast.success('Ref copied'))
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Button component={RouterLink} to="/admin/orders"
          startIcon={<ArrowBackIcon />} sx={{ textTransform: 'none' }}>
          All orders
        </Button>
        <Tooltip title="Print">
          <IconButton onClick={() => window.print()}>
            <PrintOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Hero */}
      <Paper elevation={0} sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 3,
        background: `linear-gradient(135deg, ${STATUS_HEX[order.status]}33 0%, #0f172a 100%)`,
        color: '#fff', p: { xs: 2.5, md: 3.5 },
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: STATUS_HEX[order.status] }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.8)' }}>
                Order · {order.status}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.01em' }}>
                {order.ref}
              </Typography>
              <Tooltip title="Copy ref">
                <IconButton onClick={copyRef} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, mt: 0.5 }}>
              Placed {new Date(order.createdAt).toLocaleString()} · DB id #{order.id}
            </Typography>
          </Box>
          <Box sx={{ textAlign: { md: 'right' } }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total
            </Typography>
            <Typography sx={{ fontSize: 36, fontWeight: 800, fontFamily: 'ui-monospace, monospace', lineHeight: 1 }}>
              ${order.total.toFixed(2)}
            </Typography>
            <Chip
              label={order.paymentMethod.toUpperCase()}
              size="small"
              sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 }}
            />
          </Box>
        </Stack>
      </Paper>

      {/* Status changer */}
      <Card sx={{ borderRadius: 2.5 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Update status
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                Move the order through the fulfillment pipeline.
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              value={order.status}
              onChange={(_, v: Order['status'] | null) => v && v !== order.status && setStatus(v)}
              disabled={busy}
              size="small"
              sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 2 } }}
            >
              {STATUSES.map(s => (
                <ToggleButton key={s} value={s}
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: STATUS_HEX[s], color: '#fff',
                      '&:hover': { bgcolor: STATUS_HEX[s], opacity: 0.9 },
                    },
                  }}>
                  {s}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        {/* Items */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Line items</Typography>
              <Stack divider={<Divider />} spacing={0}>
                {order.items.map(it => (
                  <Stack key={it.productId} direction="row" spacing={2} sx={{ py: 1.5, alignItems: 'center' }}>
                    <Box sx={{
                      width: 56, height: 56, flexShrink: 0, borderRadius: 1.5, overflow: 'hidden', bgcolor: '#f1f5f9',
                      ...(it.imagePath ? {
                        backgroundImage: `url(${it.imagePath})`, backgroundSize: 'cover', backgroundPosition: 'center',
                      } : {}),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {!it.imagePath && (
                        <Typography sx={{ fontSize: 22, color: '#94a3b8', fontWeight: 700 }}>
                          {it.name[0]?.toUpperCase() ?? '?'}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>{it.name}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {it.qty} × ${it.price.toFixed(2)}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 14 }}>
                      ${(it.qty * it.price).toFixed(2)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={0.75} sx={{ ml: 'auto', maxWidth: 280 }}>
                <Row label="Subtotal" value={`$${order.subtotal.toFixed(2)}`} />
                <Row label="Shipping" value={order.shippingFee > 0 ? `$${order.shippingFee.toFixed(2)}` : 'Free'} />
                {order.codFee > 0 && (
                  <Row label="COD fee" value={`$${order.codFee.toFixed(2)}`} />
                )}
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 0.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Total
                  </Typography>
                  <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: 18 }}>
                    ${order.total.toFixed(2)}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar: customer + payment */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Card sx={{ borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                  <LocalShippingOutlinedIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Customer</Typography>
                </Stack>
                <InfoRow icon={<PersonOutlineIcon fontSize="small" />} label="Name" value={order.customerName} />
                <InfoRow icon={<PhoneOutlinedIcon fontSize="small" />} label="Phone" value={order.phone} />
                <InfoRow icon={<HomeOutlinedIcon fontSize="small" />} label="Address" value={order.address} multiline />
                <Divider sx={{ my: 1.5 }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  Account: <code style={{ fontWeight: 600 }}>{order.username}</code>
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <PaymentsOutlinedIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Payment</Typography>
                </Stack>
                <Chip label={order.paymentMethod.toUpperCase()} color="primary" sx={{ mt: 0.5 }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
                  {order.paymentMethod === 'cod'
                    ? 'Cash on delivery — collect at handoff.'
                    : 'Payment captured via external provider.'}
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{value}</Typography>
    </Stack>
  )
}

function InfoRow({ icon, label, value, multiline }: { icon: React.ReactNode; label: string; value: string; multiline?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', py: 0.5 }}>
      <Box sx={{ color: 'text.secondary', mt: 0.25 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  )
}
