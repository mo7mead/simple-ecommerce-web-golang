import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Button, Stack } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/Delete'
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined'
import { useCart } from '../CartContext'
import { useAuth } from '../AuthContext'

export default function Cart() {
  const { items, total: subtotal, setQty, remove, clear } = useCart()
  const { settings } = useAuth()
  const nav = useNavigate()
  const shippingFee = settings?.shippingFee ?? 0
  const codFee = settings?.codFee ?? 0
  const grand = subtotal + shippingFee + codFee

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <ShoppingBagOutlinedIcon sx={{ fontSize: 56, color: '#cbd5e1' }} />
        <h2 className="mt-3 text-xl font-bold text-slate-900">Your cart is empty</h2>
        <p className="mt-1 text-sm text-slate-500">Browse the store and add something to your cart.</p>
        <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 3 }}>
          Continue shopping
        </Button>
      </div>
    )
  }

  return (
    <Stack spacing={3}>
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Your cart</h1>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-slate-500 hover:text-rose-600"
        >
          Clear all
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {items.map((it, idx) => (
          <div
            key={it.id}
            className={`flex items-center gap-4 p-4 ${idx > 0 ? 'border-t border-slate-100' : ''}`}
          >
            <div className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-slate-100">
              {it.imagePath ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${it.imagePath})` }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-slate-300">
                  {it.name[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold text-slate-900">{it.name}</p>
              <p className="text-xs text-slate-500">${it.price.toFixed(2)} each</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQty(it.id, it.qty - 1)}
                className="h-8 w-8 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                aria-label="Decrease"
              >−</button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">{it.qty}</span>
              <button
                type="button"
                onClick={() => setQty(it.id, it.qty + 1)}
                disabled={it.qty >= it.stock}
                className="h-8 w-8 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                aria-label="Increase"
              >+</button>
            </div>
            <div className="w-20 text-right text-sm font-bold tabular-nums text-slate-900">
              ${(it.price * it.qty).toFixed(2)}
            </div>
            <button
              type="button"
              onClick={() => remove(it.id)}
              className="text-slate-400 hover:text-rose-600"
              aria-label="Remove"
            >
              <DeleteOutlineIcon />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="ml-auto max-w-sm space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Shipping</span>
            <span className="tabular-nums">{shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : 'Free'}</span>
          </div>
          {codFee > 0 && settings?.codEnabled && (
            <div className="flex justify-between text-slate-600">
              <span>Cash-on-delivery fee</span>
              <span className="tabular-nums">${codFee.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">Total</span>
            <span className="text-2xl font-extrabold tabular-nums text-slate-900">${grand.toFixed(2)}</span>
          </div>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => nav('/checkout')}
            sx={{ mt: 2 }}
          >
            Checkout
          </Button>
        </div>
      </div>
    </Stack>
  )
}
