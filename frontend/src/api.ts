export interface User {
  id: number
  username: string
  displayName: string
  email: string
  avatarPath: string
  coverPath: string
  role: 'admin' | 'seller' | string
  createdAt: string
}

export interface SiteSettings {
  siteName: string
  tagline: string
  logoPath: string
  accentColor: string
  codEnabled: boolean
  codFee: number
  shippingFee: number
}

export interface OrderItem {
  productId: number
  name: string
  price: number
  qty: number
  imagePath: string
}

export interface Order {
  id: number
  ref: string
  userId: number
  username: string
  customerName: string
  phone: string
  address: string
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  codFee: number
  total: number
  paymentMethod: string
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled'
  createdAt: string
}

export interface PaymentsConfig {
  codEnabled: boolean
  codFee: number
  shippingFee: number
}

export interface Category {
  id: number
  parentId?: number
  name: string
  slug: string
  icon: string
  children?: Category[]
}

export interface Brand {
  id: number
  name: string
  slug: string
  logoPath: string
  website: string
  position: number
  createdAt: string
}

export interface FlashSale {
  id: number
  productId: number | null
  productName: string
  productSku: string
  title: string
  imagePath: string
  originalPrice: number
  salePrice: number
  stock: number
  sold: number
  endsAt: string
  position: number
  createdAt: string
}

export interface Slide {
  ID: number
  Title: string
  Body: string
  ImagePath: string
  Position: number
  CreatedAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function upload<T>(path: string, fd: FormData): Promise<T> {
  const res = await fetch(path, { method: 'POST', credentials: 'include', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface AdminStats {
  totalUsers: number
  totalAdmins: number
  totalSellers: number
  activeSessions: number
  totalCategories: number
  totalSlides: number
  totalProducts: number
  inventoryValue: number
  newUsers7d: number
  newProducts7d: number
  yourSessionSec: number
  recentSessions: { username: string; avatarPath: string; createdAt: string; expiresAt: string }[]
  recentUsers: User[]
  recentProducts: { id: number; name: string; price: number; stock: number; sellerId: number; createdAt: string }[]
}

export const api = {
  me: () => request<{ user: User | null }>('/api/me'),
  login: (username: string, password: string) =>
    request<{ user: User }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/logout', { method: 'POST' }),
  settings: () => request<SiteSettings>('/api/settings'),
  categories: () => request<Category[]>('/api/categories'),
  slides: () => request<Slide[] | null>('/api/slides'),
  flashSales: () => request<FlashSale[] | null>('/api/flash-sales'),
  brands: () => request<Brand[] | null>('/api/brands'),
  profile: () => request<User>('/api/profile'),
  updateProfile: (displayName: string, email: string) =>
    request<User>('/api/profile/update', {
      method: 'POST',
      body: JSON.stringify({ displayName, email }),
    }),
  changePassword: (current: string, newPass: string) =>
    request<{ ok: boolean }>('/api/profile/password', {
      method: 'POST',
      body: JSON.stringify({ current, new: newPass }),
    }),
  adminStats: () => request<AdminStats>('/api/admin/stats'),
  adminUsers: () => request<User[]>('/api/admin/users'),
  adminSessions: () => request<{ username: string; avatarPath: string; createdAt: string; expiresAt: string }[]>('/api/admin/sessions'),
  adminSystem: () => request<{ goVersion: string; sessionTTL: string; db: string }>('/api/admin/system'),

  adminSlides: () => request<Slide[] | null>('/api/admin/slides'),
  adminSlideUpload: (title: string, body: string, file: File) => {
    const fd = new FormData(); fd.append('title', title); fd.append('body', body); fd.append('image', file)
    return upload<{ ok: boolean }>('/api/admin/slides', fd)
  },
  adminSlideDelete: (id: number) =>
    request<{ ok: boolean }>('/api/admin/slides/delete', { method: 'POST', body: JSON.stringify({ id }) }),
  adminSlideReorder: (ids: number[]) =>
    request<{ ok: boolean }>('/api/admin/slides/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  adminCategories: () => request<{ id: number; parentId: number | null; name: string; slug: string; icon: string; position: number }[]>('/api/admin/categories'),
  adminCategoryCreate: (name: string, icon: string, parentId: number | null) =>
    request<{ ok: boolean }>('/api/admin/categories', {
      method: 'POST', body: JSON.stringify({ name, icon, parentId }),
    }),
  adminCategoryDelete: (id: number) =>
    request<{ ok: boolean }>('/api/admin/categories/delete', { method: 'POST', body: JSON.stringify({ id }) }),

  adminFlashSales: () => request<FlashSale[] | null>('/api/admin/flash-sales'),
  adminFlashSaleCreate: (form: {
    title: string; originalPrice: number; salePrice: number;
    stock: number; endsAt: string; image?: File | null; productId?: number | null
  }) => {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('originalPrice', String(form.originalPrice))
    fd.append('salePrice', String(form.salePrice))
    fd.append('stock', String(form.stock))
    fd.append('endsAt', form.endsAt)
    if (form.productId) fd.append('productId', String(form.productId))
    if (form.image) fd.append('image', form.image)
    return upload<{ ok: boolean }>('/api/admin/flash-sales', fd)
  },
  adminFlashSaleDelete: (id: number) =>
    request<{ ok: boolean }>('/api/admin/flash-sales/delete', {
      method: 'POST', body: JSON.stringify({ id }),
    }),

  adminBrands: () => request<Brand[] | null>('/api/admin/brands'),
  adminBrandCreate: (form: { name: string; website: string; logo?: File | null }) => {
    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('website', form.website)
    if (form.logo) fd.append('logo', form.logo)
    return upload<{ ok: boolean }>('/api/admin/brands', fd)
  },
  adminBrandDelete: (id: number) =>
    request<{ ok: boolean }>('/api/admin/brands/delete', {
      method: 'POST', body: JSON.stringify({ id }),
    }),

  adminBrandingGet: () => request<SiteSettings>('/api/admin/branding'),
  adminBrandingSave: (siteName: string, tagline: string, accentColor: string, logo?: File | null) => {
    const fd = new FormData()
    fd.append('siteName', siteName); fd.append('tagline', tagline); fd.append('accentColor', accentColor)
    if (logo) fd.append('logo', logo)
    return upload<SiteSettings>('/api/admin/branding', fd)
  },
  adminLogoDelete: () =>
    request<{ ok: boolean }>('/api/admin/branding/logo-delete', { method: 'POST' }),

  uploadAvatar: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return upload<User>('/api/profile/avatar', fd)
  },
  deleteAvatar: () => request<User>('/api/profile/avatar-delete', { method: 'POST' }),
  uploadCover: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return upload<User>('/api/profile/cover', fd)
  },
  deleteCover: () => request<User>('/api/profile/cover-delete', { method: 'POST' }),

  products: () => request<Product[] | null>('/api/products'),

  sellerStats: () => request<{ TotalProducts: number; TotalStock: number; InventoryValue: number; RecentProducts: any[] }>('/api/seller/stats'),
  sellerProducts: () => request<Product[] | null>('/api/seller/products'),
  sellerProductCreate: (form: {
    name: string; description: string; price: number; stock: number;
    shippingDays: number; categoryId: number | null; brandId: number | null;
    image: File | null
  }) => {
    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('description', form.description)
    fd.append('price', String(form.price))
    fd.append('stock', String(form.stock))
    fd.append('shippingDays', String(form.shippingDays))
    fd.append('categoryId', form.categoryId ? String(form.categoryId) : '')
    fd.append('brandId', form.brandId ? String(form.brandId) : '')
    if (form.image) fd.append('image', form.image)
    return upload<{ ok: boolean; sku: string; status: string }>('/api/seller/products/create', fd)
  },
  sellerProductDelete: (id: number) =>
    request<{ ok: boolean }>('/api/seller/products/delete', { method: 'POST', body: JSON.stringify({ id }) }),

  adminProducts: (status?: 'pending' | 'approved' | 'rejected' | 'all') =>
    request<Product[] | null>(`/api/admin/products${status ? `?status=${status}` : ''}`),
  adminProductApprove: (id: number) =>
    request<{ ok: boolean }>('/api/admin/products/approve', {
      method: 'POST', body: JSON.stringify({ id }),
    }),
  adminProductReject: (id: number, note: string) =>
    request<{ ok: boolean }>('/api/admin/products/reject', {
      method: 'POST', body: JSON.stringify({ id, note }),
    }),
  adminProductSetStatus: (id: number, status: 'pending' | 'approved' | 'rejected', note?: string) =>
    request<{ ok: boolean }>('/api/admin/products/status', {
      method: 'POST', body: JSON.stringify({ id, status, note: note || '' }),
    }),
  adminProductBulkStatus: (ids: number[], status: 'pending' | 'approved' | 'rejected', note?: string) =>
    request<{ ok: boolean; changed: number }>('/api/admin/products/bulk-status', {
      method: 'POST', body: JSON.stringify({ ids, status, note: note || '' }),
    }),

  adminPaymentsGet: () => request<PaymentsConfig>('/api/admin/payments'),
  adminPaymentsSave: (cfg: PaymentsConfig) =>
    request<PaymentsConfig>('/api/admin/payments', {
      method: 'POST', body: JSON.stringify(cfg),
    }),
  adminOrders: () => request<Order[] | null>('/api/admin/orders'),
  adminOrder: (ref: string) =>
    request<Order>(`/api/admin/order/${encodeURIComponent(ref)}`),
  adminOrderStatus: (id: number, status: Order['status']) =>
    request<{ ok: boolean }>('/api/admin/orders/status', {
      method: 'POST', body: JSON.stringify({ id, status }),
    }),
  myOrders: () => request<Order[] | null>('/api/orders'),
  createOrder: (body: {
    customerName: string; phone: string; address: string;
    paymentMethod: string;
    items: { productId: number; qty: number }[];
  }) =>
    request<{ ok: boolean; id: number; ref: string; subtotal: number; shippingFee: number; codFee: number; total: number }>(
      '/api/orders/create', { method: 'POST', body: JSON.stringify(body) }),

  adminNotifications: (limit = 25) =>
    request<{ items: AdminNotification[]; unread: number }>(`/api/admin/notifications?limit=${limit}`),
  adminNotificationsRead: (ids?: number[]) =>
    request<{ ok: boolean; marked: number }>('/api/admin/notifications/read', {
      method: 'POST', body: JSON.stringify({ ids: ids || [] }),
    }),
}

export interface AdminNotification {
  id: number
  kind: string
  title: string
  body: string
  link: string
  relatedId: number | null
  readAt: string | null
  createdAt: string
}

export interface Product {
  id: number
  sellerId: number
  sellerUsername: string
  sku: string
  name: string
  description: string
  imagePath: string
  price: number
  stock: number
  shippingDays: number
  categoryId: number | null
  categoryName: string
  brandId: number | null
  brandName: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string
  createdAt: string
}
