import { Box, Card, CardContent, Typography, Stack, Chip } from '@mui/material'
import { useAuth } from '../AuthContext'

export default function Dashboard({ kind }: { kind: 'admin' | 'seller' }) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 600 }}>
          {kind} overview
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome back, {user.displayName || user.username}
        </Typography>
        <Chip size="small" label={user.role} color={user.role === 'admin' ? 'primary' : 'success'} />
      </Box>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {kind === 'admin' ? 'Admin' : 'Seller'} dashboard
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 1 }}>
            The React/MUI rebuild is in progress. Until the full {kind} screens are ported,
            you can still use the original server-rendered pages at{' '}
            <Box component="a" href={`/${kind}/dashboard`} sx={{ color: 'primary.main' }}>
              /{kind}/dashboard
            </Box>.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}
