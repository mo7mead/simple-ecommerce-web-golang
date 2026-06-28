import { useState } from 'react'
import { Box, Card, CardContent, TextField, Button, Typography, Stack, Chip, Link } from '@mui/material'
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Toast'

export default function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: { pathname: string } } }
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(username, password)
      nav(loc.state?.from?.pathname || '/')
    } catch (e) {
      toast.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Welcome back</Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3, fontSize: 14 }}>
            Sign in to your account
          </Typography>
          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Username" value={username} onChange={(e) => setUsername(e.target.value)}
                autoFocus required fullWidth autoComplete="username"
              />
              <TextField
                label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required fullWidth autoComplete="current-password"
              />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </form>
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>Demo accounts</Typography>
            <Stack direction="row" spacing={1}>
              <Chip size="small" label="admin / admin" onClick={() => { setUsername('admin'); setPassword('admin') }} />
              <Chip size="small" label="seller / seller" onClick={() => { setUsername('seller'); setPassword('seller') }} />
              <Chip size="small" label="buyer / buyer" onClick={() => { setUsername('buyer'); setPassword('buyer') }} />
            </Stack>
          </Box>
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              No account?{' '}
              <Link component={RouterLink} to="/register">Create one</Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
