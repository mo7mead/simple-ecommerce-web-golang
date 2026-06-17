import { useEffect, useState } from 'react'
import { Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Avatar, Stack, Skeleton } from '@mui/material'
import { api } from '../../api'

type Sess = { username: string; avatarPath: string; createdAt: string; expiresAt: string }

export default function AdminSessions() {
  const [rows, setRows] = useState<Sess[] | null>(null)
  useEffect(() => { api.adminSessions().then(setRows).catch(console.error) }, [])
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Active sessions</Typography>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead><TableRow><TableCell>User</TableCell><TableCell>Started</TableCell><TableCell>Expires</TableCell></TableRow></TableHead>
          <TableBody>
            {!rows ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={3}><Skeleton /></TableCell></TableRow>
            )) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={3}><Typography color="text.secondary">No active sessions.</Typography></TableCell></TableRow>
            ) : rows.map((s, i) => (
              <TableRow key={i} hover>
                <TableCell>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                    <Avatar src={s.avatarPath || undefined} sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 11 }}>
                      {s.username[0]?.toUpperCase()}
                    </Avatar>
                    <Typography sx={{ fontSize: 14 }}>{s.username}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{new Date(s.createdAt).toLocaleString()}</TableCell>
                <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{new Date(s.expiresAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  )
}
