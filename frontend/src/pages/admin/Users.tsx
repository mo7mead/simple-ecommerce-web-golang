import { useEffect, useState } from 'react'
import { Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Avatar, Chip, Stack, Skeleton } from '@mui/material'
import { api, type User } from '../../api'

export default function AdminUsers() {
  const [users, setUsers] = useState<User[] | null>(null)
  useEffect(() => { api.adminUsers().then(setUsers).catch(console.error) }, [])
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Users</Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell><TableCell>User</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Joined</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!users ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton /></TableCell></TableRow>
            )) : users.map(u => (
              <TableRow key={u.id} hover>
                <TableCell>{u.id}</TableCell>
                <TableCell>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                    <Avatar src={u.avatarPath || undefined} sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12 }}>
                      {(u.displayName || u.username)[0]?.toUpperCase()}
                    </Avatar>
                    <Stack>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{u.displayName || u.username}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>@{u.username}</Typography>
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{u.email || '—'}</TableCell>
                <TableCell><Chip size="small" label={u.role} color={u.role === 'admin' ? 'primary' : 'success'} /></TableCell>
                <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{new Date(u.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  )
}
