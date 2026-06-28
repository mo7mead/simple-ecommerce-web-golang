import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Button, Stack, Chip } from '@mui/material'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { api, type Order } from '../../api'

const STATUS_COLOR: Record<Order['status'], 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'error',
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  useEffect(() => { api.myOrders().then(setOrders).catch(console.error) }, [])

  if (!orders) return <p className="text-slate-500">Loading…</p>

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <ReceiptLongOutlinedIcon sx={{ fontSize: 56, color: '#cbd5e1' }} />
        <h2 className="mt-3 text-xl font-bold text-slate-900">No orders yet</h2>
        <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 3 }}>Start shopping</Button>
      </div>
    )
  }

  return (
    <Stack spacing={3}>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Your orders</h1>
      {orders.map(o => (
        <div key={o.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Order ref</p>
              <p className="font-mono text-sm font-bold text-slate-900">{o.ref || `#${o.id}`}</p>
              <p className="mt-0.5 text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Chip size="small" label={o.paymentMethod.toUpperCase()} variant="outlined" />
              <Chip size="small" label={o.status} color={STATUS_COLOR[o.status]} />
              <span className="text-lg font-extrabold tabular-nums text-slate-900">
                ${o.total.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {o.items.map(it => (
              <div key={it.productId} className="flex items-center gap-3 p-3 text-sm">
                <div className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-slate-100">
                  {it.imagePath
                    ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${it.imagePath})` }} />
                    : <div className="flex h-full w-full items-center justify-center text-xl text-slate-300">
                        {it.name[0]?.toUpperCase() ?? '?'}
                      </div>}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{it.name}</p>
                  <p className="text-xs text-slate-500">{it.qty} × ${it.price.toFixed(2)}</p>
                </div>
                <span className="tabular-nums text-slate-900">${(it.qty * it.price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Stack>
  )
}
