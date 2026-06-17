import { useEffect, useState } from 'react'
import { Stack, Typography, Card, CardContent, Grid, Paper, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material'
import { api } from '../../api'
import { useAuth } from '../../AuthContext'

export default function SellerDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  useEffect(() => { api.sellerStats().then(setStats).catch(console.error) }, [])
  if (!user) return null
  return (
    <Stack spacing={3}>
      <Paper sx={{ background: 'linear-gradient(135deg, #0f4c3a, #1a6650)', color: '#fff', p: 3, borderRadius: 2.5 }}>
        <Typography sx={{ color: '#6fdcb6', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Seller overview</Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 700, mt: 1 }}>Welcome back, {user.displayName || user.username}</Typography>
        <Typography sx={{ color: '#9bbfb0', fontSize: 14, mt: 0.5 }}>Account created {new Date(user.createdAt).toLocaleDateString()}</Typography>
      </Paper>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card><CardContent>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Products</Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 700 }}>{stats?.TotalProducts ?? '…'}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card><CardContent>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Total stock</Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 700 }}>{stats?.TotalStock ?? '…'}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card><CardContent>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Inventory value</Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 700 }}>${(stats?.InventoryValue || 0).toFixed(2)}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>
      {stats?.RecentProducts?.length > 0 && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Price</TableCell><TableCell>Stock</TableCell><TableCell>Added</TableCell></TableRow></TableHead>
            <TableBody>
              {stats.RecentProducts.map((p: any) => (
                <TableRow key={p.ID} hover>
                  <TableCell><Typography sx={{ fontWeight: 600 }}>{p.Name}</Typography></TableCell>
                  <TableCell>${p.Price.toFixed(2)}</TableCell>
                  <TableCell>{p.Stock}</TableCell>
                  <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{new Date(p.CreatedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  )
}
