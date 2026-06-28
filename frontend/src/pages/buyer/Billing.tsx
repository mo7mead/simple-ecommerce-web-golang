import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Stack, Chip, Button, Divider, Alert,
} from '@mui/material'
import PaymentsIcon from '@mui/icons-material/Payments'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import CreditCardOffIcon from '@mui/icons-material/CreditCardOff'
import { api, type SiteSettings } from '../../api'

export default function BuyerBilling() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  useEffect(() => { api.settings().then(setSettings).catch(console.error) }, [])

  if (!settings) return <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Billing & payment</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
          Payment methods available at checkout and fees that apply.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Available payment methods</Typography>
          <Stack spacing={1.5}>
            {settings.codEnabled ? (
              <Stack direction="row" alignItems="center" spacing={2} sx={{
                p: 2, border: 1, borderColor: 'divider', borderRadius: 1,
              }}>
                <LocalAtmIcon color="success" />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>Cash on delivery</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    Pay in cash when your order arrives.
                  </Typography>
                </Box>
                {settings.codFee > 0 && (
                  <Chip label={`+$${settings.codFee.toFixed(2)} fee`} size="small" />
                )}
                <Chip label="Available" color="success" size="small" />
              </Stack>
            ) : (
              <Alert severity="warning" icon={<CreditCardOffIcon />}>
                Cash on delivery is currently disabled. Contact support to place an order.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Fees & shipping</Typography>
          <Stack divider={<Divider />}>
            <Stack direction="row" alignItems="center" sx={{ py: 1.5 }}>
              <Typography sx={{ flex: 1 }}>Standard shipping</Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {settings.shippingFee > 0 ? `$${settings.shippingFee.toFixed(2)}` : 'Free'}
              </Typography>
            </Stack>
            {settings.codEnabled && (
              <Stack direction="row" alignItems="center" sx={{ py: 1.5 }}>
                <Typography sx={{ flex: 1 }}>Cash on delivery fee</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {settings.codFee > 0 ? `$${settings.codFee.toFixed(2)}` : 'Free'}
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: '#f8fafc' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <PaymentsIcon color="primary" />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Ready to shop?</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Your default address and preferred payment method are used automatically at checkout.
              </Typography>
            </Box>
            <Button component={RouterLink} to="/" variant="contained">Browse products</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
