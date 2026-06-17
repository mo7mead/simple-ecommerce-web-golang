import { useEffect, useState } from 'react'
import { Typography, Stack, Card, CardContent, Box, Grid } from '@mui/material'
import { api } from '../../api'

export default function AdminSettings() {
  const [info, setInfo] = useState<{ goVersion: string; sessionTTL: string; db: string } | null>(null)
  useEffect(() => { api.adminSystem().then(setInfo).catch(console.error) }, [])
  const rows = [
    { label: 'Database', value: info?.db || '…' },
    { label: 'Session TTL', value: info?.sessionTTL || '…' },
    { label: 'Go version', value: info?.goVersion || '…' },
  ]
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>System</Typography>
      <Grid container spacing={2}>
        {rows.map(r => (
          <Grid size={{ xs: 12, sm: 4 }} key={r.label}>
            <Card>
              <CardContent>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  {r.label}
                </Typography>
                <Box sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 16, mt: 0.5 }}>{r.value}</Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography color="text.secondary" sx={{ fontSize: 13 }}>Settings management is not implemented in this demo.</Typography>
    </Stack>
  )
}
