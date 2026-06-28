import { useEffect, useState } from 'react'
import { Skeleton, Avatar, Stack } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined'
import { api, type AdminStats } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

const fmtDur = (s: number) => {
  if (s <= 0) return '0s'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}
const fmtDate = (s: string) => {
  const d = new Date(s)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

interface KPI {
  label: string
  value: string | number
  delta?: number
  deltaSuffix?: string
  caption?: React.ReactNode
  icon: React.ReactNode
  /** Tailwind utility for gradient-from color */
  from: string
  /** Tailwind utility for gradient-to color */
  to: string
  /** Foreground icon color class */
  iconText: string
  /** Background tint for icon well */
  iconBg: string
  href?: string
}

function KpiCard({ k }: { k: KPI }) {
  const Wrap = ({ children }: { children: React.ReactNode }) =>
    k.href ? (
      <RouterLink to={k.href} className="block no-underline text-inherit">{children}</RouterLink>
    ) : <>{children}</>

  return (
    <Wrap>
      <div className={`relative h-full overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-slate-200/70
                       transition hover:-translate-y-0.5 hover:shadow-md`}>
        <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${k.from} ${k.to} opacity-10`} />
        <div className="relative flex items-start justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{k.label}</div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${k.iconBg} ${k.iconText}`}>
            {k.icon}
          </div>
        </div>
        <div className="relative mt-2.5 flex items-baseline gap-2">
          <div className="text-[26px] font-extrabold leading-none tracking-tight text-slate-900">{k.value}</div>
          {k.delta !== undefined && k.delta !== 0 && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold
                              ${k.delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <TrendingUpRoundedIcon sx={{ fontSize: 12, transform: k.delta > 0 ? 'none' : 'scaleY(-1)' }} />
              {k.delta > 0 ? '+' : ''}{k.delta}{k.deltaSuffix || ''}
            </span>
          )}
        </div>
        {k.caption && (
          <div className="relative mt-3 border-t border-slate-100 pt-2.5 text-[12px] text-slate-500">
            {k.caption}
          </div>
        )}
      </div>
    </Wrap>
  )
}

function SectionHead({ title, href, icon }: { title: string; href?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div className="flex items-center gap-2">
        {icon && <div className="text-slate-400">{icon}</div>}
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
      </div>
      {href && (
        <RouterLink to={href} className="group inline-flex items-center gap-0.5 text-[12.5px] font-semibold
                                         text-indigo-600 no-underline hover:text-indigo-700">
          View all
          <ArrowOutwardRoundedIcon sx={{ fontSize: 14 }} className="transition group-hover:translate-x-0.5" />
        </RouterLink>
      )}
    </div>
  )
}

const roleChip = (role: string) =>
  role === 'admin'
    ? <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">admin</span>
    : role === 'seller'
    ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">seller</span>
    : <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{role}</span>

export default function AdminDashboard() {
  const { user, settings } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    api.adminStats().then(setStats).catch((e) => setErr(e.message))
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (err) return <div className="rounded-lg bg-rose-50 p-4 text-rose-700">{err}</div>
  if (!user) return null

  const hour = now.getHours()
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const kpis: KPI[] | null = stats && [
    {
      label: 'Users', value: stats.totalUsers, delta: stats.newUsers7d, deltaSuffix: ' / 7d',
      caption: <><span className="font-semibold text-slate-700">{stats.totalAdmins}</span> admins ·{' '}
                <span className="font-semibold text-slate-700">{stats.totalSellers}</span> sellers</>,
      icon: <PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />,
      from: 'from-indigo-400', to: 'to-violet-500', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600',
      href: '/admin/users',
    },
    {
      label: 'Active sessions', value: stats.activeSessions,
      caption: <>Yours started <span className="font-semibold text-slate-700">{fmtDur(stats.yourSessionSec)}</span> ago</>,
      icon: <AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />,
      from: 'from-emerald-400', to: 'to-teal-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600',
      href: '/admin/sessions',
    },
    {
      label: 'Catalog', value: stats.totalCategories,
      caption: <>categories live in store</>,
      icon: <CategoryOutlinedIcon sx={{ fontSize: 18 }} />,
      from: 'from-amber-400', to: 'to-orange-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600',
      href: '/admin/categories',
    },
    {
      label: 'Products', value: stats.totalProducts, delta: stats.newProducts7d, deltaSuffix: ' / 7d',
      caption: <>Inventory <span className="font-semibold text-slate-700">${stats.inventoryValue.toFixed(2)}</span></>,
      icon: <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />,
      from: 'from-purple-400', to: 'to-fuchsia-500', iconBg: 'bg-purple-50', iconText: 'text-purple-600',
      href: '/admin/products',
    },
    {
      label: 'Home slides', value: stats.totalSlides,
      caption: <>shown on home carousel</>,
      icon: <CollectionsOutlinedIcon sx={{ fontSize: 18 }} />,
      from: 'from-rose-400', to: 'to-pink-500', iconBg: 'bg-rose-50', iconText: 'text-rose-600',
      href: '/admin/slides',
    },
    {
      label: 'Site brand', value: settings?.siteName || '—',
      caption: <RouterLink to="/admin/branding" className="font-semibold text-indigo-600 no-underline hover:text-indigo-700">
        Edit branding →
      </RouterLink>,
      icon: <StorefrontOutlinedIcon sx={{ fontSize: 18 }} />,
      from: 'from-slate-400', to: 'to-slate-600', iconBg: 'bg-slate-100', iconText: 'text-slate-700',
    },
  ]

  return (
    <Stack spacing={3}>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl
                      bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white
                      shadow-lg ring-1 ring-white/5">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full
                        bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full
                        bg-gradient-to-br from-violet-500/20 to-cyan-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5
                            text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-200 ring-1 ring-white/10 backdrop-blur">
              <BoltOutlinedIcon sx={{ fontSize: 12 }} />
              Admin overview
            </div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">
              {greeting}, {user.displayName || user.username}
            </h1>
            <p className="mt-1 text-[14px] text-slate-300">
              {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} ·
              {' '}{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {stats && <> · Session {fmtDur(stats.yourSessionSec)}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RouterLink to="/admin/flash-sales" className="no-underline">
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold
                                 text-slate-900 shadow-sm transition hover:shadow-md hover:bg-slate-50">
                <AddRoundedIcon sx={{ fontSize: 16 }} />
                New flash deal
              </button>
            </RouterLink>
            <RouterLink to="/admin/slides" className="no-underline">
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold
                                 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
                <CollectionsOutlinedIcon sx={{ fontSize: 16 }} />
                Add slide
              </button>
            </RouterLink>
            <RouterLink to="/admin/products" className="no-underline">
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold
                                 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
                <RocketLaunchOutlinedIcon sx={{ fontSize: 16 }} />
                Review queue
              </button>
            </RouterLink>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(kpis || Array.from({ length: 6 })).map((k, i) => (
          k ? <KpiCard key={i} k={k as KPI} />
            : <Skeleton key={i} variant="rounded" height={140} className="!rounded-2xl" />
        ))}
      </div>

      {/* Two-column lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent sessions */}
        <section>
          <SectionHead title="Recent sessions" href="/admin/sessions"
            icon={<AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />} />
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
            {!stats ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={36} />)}
              </div>
            ) : stats.recentSessions.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-slate-500">No sessions yet.</div>
            ) : (
              <ul className="list-none m-0 p-0 divide-y divide-slate-100">
                {stats.recentSessions.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <Avatar src={s.avatarPath || undefined}
                      sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}>
                      {s.username[0]?.toUpperCase()}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-slate-900">@{s.username}</div>
                      <div className="text-[11.5px] text-slate-500">Started {fmtDate(s.createdAt)}</div>
                    </div>
                    <div className="hidden text-right text-[11.5px] text-slate-500 sm:block">
                      <div>Expires</div>
                      <div className="font-medium text-slate-700">{fmtDate(s.expiresAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* New users */}
        <section>
          <SectionHead title="New users" href="/admin/users"
            icon={<PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />} />
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
            {!stats ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={36} />)}
              </div>
            ) : stats.recentUsers.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-slate-500">No users.</div>
            ) : (
              <ul className="list-none m-0 p-0 divide-y divide-slate-100">
                {stats.recentUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <Avatar src={u.avatarPath || undefined}
                      sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main' }}>
                      {(u.displayName || u.username)[0]?.toUpperCase()}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-slate-900">
                        {u.displayName || u.username}
                      </div>
                      <div className="text-[11.5px] text-slate-500">@{u.username} · Joined {fmtDate(u.createdAt)}</div>
                    </div>
                    {roleChip(u.role)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Latest products from sellers */}
      {stats && stats.recentProducts && stats.recentProducts.length > 0 && (
        <section>
          <SectionHead title="Latest products from sellers" href="/admin/products"
            icon={<Inventory2OutlinedIcon sx={{ fontSize: 18 }} />} />
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
            <ul className="list-none m-0 p-0 divide-y divide-slate-100">
              {stats.recentProducts.map((p) => (
                <li key={p.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="col-span-12 sm:col-span-5">
                    <div className="text-[14px] font-semibold text-slate-900">{p.name}</div>
                    <div className="text-[11.5px] text-slate-500">Added {fmtDate(p.createdAt)}</div>
                  </div>
                  <div className="col-span-4 sm:col-span-2 text-right sm:text-left">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">Price</div>
                    <div className="text-[13.5px] font-semibold text-slate-900">${p.price.toFixed(2)}</div>
                  </div>
                  <div className="col-span-4 sm:col-span-2 text-right sm:text-left">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">Stock</div>
                    <div className="text-[13.5px] font-semibold text-slate-900">{p.stock}</div>
                  </div>
                  <div className="col-span-4 sm:col-span-3 text-right">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">Value</div>
                    <div className="text-[13.5px] font-semibold text-slate-900">
                      ${(p.price * p.stock).toFixed(2)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </Stack>
  )
}
