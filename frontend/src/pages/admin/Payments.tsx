import { useEffect, useState } from 'react'
import {
  Typography, Stack, Card, CardContent, TextField, Button, Switch,
  FormControlLabel, InputAdornment, LinearProgress, Box, Grid,
} from '@mui/material'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import { api } from '../../api'
import { useToast } from '../../Toast'
import { useAuth } from '../../AuthContext'

export default function AdminPayments() {
  const toast = useToast()
  const { refresh } = useAuth()
  const [codEnabled, setCodEnabled] = useState(true)
  const [codFee, setCodFee] = useState('0')
  const [shippingFee, setShippingFee] = useState('0')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.adminPaymentsGet().then(c => {
      setCodEnabled(c.codEnabled)
      setCodFee(c.codFee.toFixed(2))
      setShippingFee(c.shippingFee.toFixed(2))
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const cf = parseFloat(codFee)
      const sf = parseFloat(shippingFee)
      if (Number.isNaN(cf) || Number.isNaN(sf) || cf < 0 || sf < 0) {
        toast.error('Fees must be non-negative numbers.')
        return
      }
      await api.adminPaymentsSave({ codEnabled, codFee: cf, shippingFee: sf })
      toast.success('Payment settings saved.')
      refresh()
    } catch (err) { toast.error(err) } finally { setBusy(false) }
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Payments & fees</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>
          Configure cash-on-delivery and flat shipping charges applied at checkout.
        </Typography>
      </Box>

      {loading && <LinearProgress />}

      <form onSubmit={save}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <PaymentsOutlinedIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Cash on delivery</Typography>
                </Stack>
                <FormControlLabel
                  control={<Switch checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} />}
                  label="Allow customers to pay cash on delivery"
                />
                <TextField
                  label="COD fee"
                  size="small"
                  type="number"
                  fullWidth
                  sx={{ mt: 2 }}
                  value={codFee}
                  onChange={e => setCodFee(e.target.value)}
                  disabled={!codEnabled}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    },
                    htmlInput: { step: '0.01', min: 0 },
                  }}
                  helperText="Added to the order total when paying COD."
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <LocalShippingOutlinedIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Shipping</Typography>
                </Stack>
                <TextField
                  label="Flat shipping fee"
                  size="small"
                  type="number"
                  fullWidth
                  sx={{ mt: 2 }}
                  value={shippingFee}
                  onChange={e => setShippingFee(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    },
                    htmlInput: { step: '0.01', min: 0 },
                  }}
                  helperText="Set 0 for free shipping."
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Stack direction="row" sx={{ mt: 2.5, justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}
