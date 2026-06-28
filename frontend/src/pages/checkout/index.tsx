import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Button, TextField, Stack, Radio, MenuItem, Chip } from '@mui/material'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { api, type Address } from '../../api'
import { useCart } from '../../contexts/CartContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Toast'

export default function Checkout() {
  const { items, total: subtotal, clear } = useCart()
  const { user, settings } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cod'>('cod')
  const [busy, setBusy] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddrId, setSelectedAddrId] = useState<number | 'new'>('new')

  useEffect(() => {
    if (!user) return
    setName(user.displayName || user.username)
    api.addresses().then(list => {
      const arr = list || []
      setSavedAddresses(arr)
      const def = arr.find(a => a.isDefault) || arr[0]
      if (def) {
        setSelectedAddrId(def.id)
        setName(def.recipient); setPhone(def.phone); setAddress(def.line)
      }
    }).catch(() => setSavedAddresses([]))
  }, [user])

  const pickAddress = (id: number | 'new') => {
    setSelectedAddrId(id)
    if (id === 'new') {
      setName(user?.displayName || user?.username || ''); setPhone(''); setAddress('')
      return
    }
    const a = savedAddresses.find(x => x.id === id)
    if (a) { setName(a.recipient); setPhone(a.phone); setAddress(a.line) }
  }

  if (!user) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <h2 className="text-xl font-bold text-slate-900">Please sign in to check out</h2>
        <Button component={RouterLink} to="/login" variant="contained" sx={{ mt: 3 }}>
          Sign in
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <h2 className="text-xl font-bold text-slate-900">Your cart is empty</h2>
        <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 3 }}>
          Continue shopping
        </Button>
      </div>
    )
  }

  const shippingFee = settings?.shippingFee ?? 0
  const codFee = paymentMethod === 'cod' ? (settings?.codFee ?? 0) : 0
  const grand = subtotal + shippingFee + codFee

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error('Name, phone, and address are required.')
      return
    }
    setBusy(true)
    try {
      const res = await api.createOrder({
        customerName: name, phone, address, paymentMethod,
        items: items.map(it => ({ productId: it.id, qty: it.qty })),
      })
      clear()
      toast.success(`Order ${res.ref} placed`)
      nav(`/orders`)
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={3}>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Checkout</h1>

      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="mb-3 flex items-center gap-2">
                <LocalShippingOutlinedIcon sx={{ color: 'primary.main' }} />
                <h2 className="text-base font-bold text-slate-900">Shipping details</h2>
              </div>
              <Stack spacing={2}>
                {savedAddresses.length > 0 && (
                  <TextField
                    select size="small" label="Saved address" value={selectedAddrId}
                    onChange={e => pickAddress(e.target.value === 'new' ? 'new' : Number(e.target.value))}
                    fullWidth
                  >
                    {savedAddresses.map(a => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.label || a.recipient} — {a.line.split('\n')[0].slice(0, 40)}
                        {a.isDefault && <Chip label="Default" size="small" sx={{ ml: 1 }} />}
                      </MenuItem>
                    ))}
                    <MenuItem value="new">Use a new address</MenuItem>
                  </TextField>
                )}
                <TextField label="Full name" size="small" value={name}
                  onChange={e => setName(e.target.value)} required fullWidth />
                <TextField label="Phone" size="small" value={phone}
                  onChange={e => setPhone(e.target.value)} required fullWidth />
                <TextField label="Address" size="small" value={address}
                  onChange={e => setAddress(e.target.value)} required fullWidth multiline minRows={3} />
              </Stack>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="mb-3 flex items-center gap-2">
                <PaymentsOutlinedIcon sx={{ color: 'primary.main' }} />
                <h2 className="text-base font-bold text-slate-900">Payment</h2>
              </div>
              {settings?.codEnabled ? (
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-indigo-300">
                  <Radio checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Cash on delivery</p>
                    <p className="text-xs text-slate-500">
                      Pay when you receive your order
                      {codFee > 0 && ` · +$${codFee.toFixed(2)} COD fee`}
                    </p>
                  </div>
                </label>
              ) : (
                <p className="text-sm text-slate-500">No payment methods are currently enabled.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:sticky md:top-4 md:self-start">
            <h2 className="mb-3 text-base font-bold text-slate-900">Order summary</h2>
            <div className="max-h-60 space-y-2 overflow-auto">
              {items.map(it => (
                <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="line-clamp-1 text-slate-700">
                    {it.qty} × {it.name}
                  </span>
                  <span className="tabular-nums text-slate-900">
                    ${(it.price * it.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="tabular-nums">{shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : 'Free'}</span>
              </div>
              {codFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>COD fee</span>
                  <span className="tabular-nums">${codFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
                <span className="text-xs uppercase tracking-wider text-slate-500">Total</span>
                <span className="text-2xl font-extrabold tabular-nums text-slate-900">${grand.toFixed(2)}</span>
              </div>
            </div>
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={busy || !settings?.codEnabled}
              sx={{ mt: 3 }}
            >
              {busy ? 'Placing order…' : `Place order · $${grand.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </form>
    </Stack>
  )
}
