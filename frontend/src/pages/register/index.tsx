import { useState } from 'react'
import { Box, Card, CardContent, TextField, Button, Typography, Stack, Link } from '@mui/material'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Toast'

export default function Register() {
  const { signUp } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await signUp(username, password)
      nav('/')
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
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Create your account</Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3, fontSize: 14 }}>
            Sign up to start shopping
          </Typography>
          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Username" value={username} onChange={(e) => setUsername(e.target.value)}
                autoFocus required fullWidth autoComplete="username"
                helperText="At least 3 characters"
              />
              <TextField
                label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required fullWidth autoComplete="new-password"
                helperText="At least 4 characters"
              />
              <TextField
                label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required fullWidth autoComplete="new-password"
              />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </Stack>
          </form>
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              Already have an account?{' '}
              <Link component={RouterLink} to="/login">Sign in</Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
