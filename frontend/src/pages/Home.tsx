import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Stack } from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import { api, type Slide, type FlashSale, type Brand } from '../api'

function ScrollRow({ children, itemWidth, gap = 16 }: { children: ReactNode; itemWidth: number; gap?: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = () => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }
  useLayoutEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [children])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    const step = Math.max(itemWidth + gap, Math.floor(el.clientWidth * 0.85))
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        disabled={!canLeft}
        aria-label="Scroll left"
        className="absolute top-1/2 -left-3 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center
                   rounded-full bg-white shadow-md ring-1 ring-black/5 transition
                   hover:shadow-lg hover:scale-105 disabled:opacity-0 disabled:pointer-events-none"
      >
        <ChevronLeftIcon />
      </button>
      <div
        ref={ref}
        className="flex overflow-x-auto pb-2 px-0.5"
        style={{ gap: `${gap}px`, scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        disabled={!canRight}
        aria-label="Scroll right"
        className="absolute top-1/2 -right-3 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center
                   rounded-full bg-white shadow-md ring-1 ring-black/5 transition
                   hover:shadow-lg hover:scale-105 disabled:opacity-0 disabled:pointer-events-none"
      >
        <ChevronRightIcon />
      </button>
      <style>{`.flex::-webkit-scrollbar{display:none}`}</style>
    </div>
  )
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [target])
  if (!target) return null
  const ms = Math.max(0, new Date(target).getTime() - now)
  const total = Math.floor(ms / 1000)
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    ms,
  }
}

function CountdownCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="min-w-[44px] rounded-md bg-white/15 px-2 py-1 text-center font-bold text-base tabular-nums backdrop-blur">
        {String(value).padStart(2, '0')}
      </div>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-white/70">{label}</span>
    </div>
  )
}

export default function Home() {
  const [slides, setSlides] = useState<Slide[] | null>(null)
  const [flash, setFlash] = useState<FlashSale[] | null>(null)
  const [brands, setBrands] = useState<Brand[] | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    api.slides().then(setSlides).catch(console.error)
    api.flashSales().then(setFlash).catch(console.error)
    api.brands().then(setBrands).catch(console.error)
  }, [])

  const nextEnd = useMemo(() => {
    if (!flash || flash.length === 0) return null
    return [...flash].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())[0].endsAt
  }, [flash])
  const countdown = useCountdown(nextEnd)

  useEffect(() => {
    if (!slides || slides.length < 2) return
    const t = setInterval(() => setActiveSlide((i) => (i + 1) % slides.length), 5000)
    return () => clearInterval(t)
  }, [slides])

  return (
    <Stack spacing={4}>
      {slides && slides.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-1 ring-black/5"
             style={{ aspectRatio: '16/6', maxHeight: 340 }}>
          {slides.map((s, i) => (
            <div
              key={s.ID}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out"
              style={{
                opacity: i === activeSlide ? 1 : 0,
                backgroundImage: `url(${s.ImagePath})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white">
                <h2 className="text-2xl font-bold tracking-tight">{s.Title}</h2>
                {s.Body && <p className="mt-1 max-w-2xl text-sm/relaxed text-white/90">{s.Body}</p>}
              </div>
            </div>
          ))}
          {slides.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === activeSlide ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {flash && flash.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-3 bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600
                          px-4 py-4 text-white sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <BoltIcon fontSize="small" />
              </span>
              <h2 className="text-xl font-extrabold tracking-tight">Flash Sale</h2>
              <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold backdrop-blur">
                {flash.length} deal{flash.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="sm:ml-auto" />
            {countdown && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  Ends in
                </span>
                {countdown.days > 0 && <CountdownCell value={countdown.days} label="days" />}
                <CountdownCell value={countdown.hours} label="hrs" />
                <CountdownCell value={countdown.minutes} label="min" />
                <CountdownCell value={countdown.seconds} label="sec" />
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <ScrollRow itemWidth={220}>
              {flash.map((f) => {
                const pct = f.originalPrice > 0
                  ? Math.round(((f.originalPrice - f.salePrice) / f.originalPrice) * 100)
                  : 0
                const soldPct = f.stock > 0 ? Math.min(100, Math.round((f.sold / f.stock) * 100)) : 0
                return (
                  <div
                    key={f.id}
                    className="group flex w-[220px] flex-none flex-col overflow-hidden rounded-xl bg-white
                               shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100">
                      <div
                        className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                        style={{ backgroundImage: `url(${f.imagePath})` }}
                      />
                      {pct > 0 && (
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full
                                        bg-gradient-to-r from-rose-600 to-pink-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                          <LocalOfferIcon sx={{ fontSize: 12 }} />
                          −{pct}%
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{f.title}</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold text-rose-600">${f.salePrice.toFixed(2)}</span>
                        {f.originalPrice > f.salePrice && (
                          <span className="text-xs text-slate-400 line-through">${f.originalPrice.toFixed(2)}</span>
                        )}
                      </div>
                      {f.stock > 0 && (
                        <div className="mt-auto">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all"
                              style={{ width: `${soldPct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {f.sold} sold · {f.stock - f.sold} left
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </ScrollRow>
          </div>
        </div>
      )}

      {brands && brands.length > 0 && (
        <div>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Top brands</h2>
            <span className="text-xs text-slate-500">{brands.length} partner{brands.length === 1 ? '' : 's'}</span>
          </div>
          <ScrollRow itemWidth={150}>
            {brands.map((b) => {
              const card = (
                <div className="group flex w-[150px] flex-none flex-col items-center overflow-hidden rounded-2xl
                                bg-white p-3 shadow-sm ring-1 ring-black/5 transition
                                hover:-translate-y-1 hover:shadow-lg hover:ring-indigo-200"
                     style={{ scrollSnapAlign: 'start' }}>
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full
                                  bg-slate-50 ring-1 ring-slate-100 transition-transform group-hover:scale-105">
                    {b.logoPath ? (
                      <img src={b.logoPath} alt={b.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-extrabold text-slate-400">
                        {b.name[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-900">{b.name}</p>
                  {b.website && (
                    <span className="line-clamp-1 text-[11px] text-slate-500">
                      {b.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </span>
                  )}
                </div>
              )
              return b.website ? (
                <a key={b.id} href={b.website} target="_blank" rel="noopener" className="no-underline">
                  {card}
                </a>
              ) : <div key={b.id}>{card}</div>
            })}
          </ScrollRow>
        </div>
      )}
    </Stack>
  )
}
