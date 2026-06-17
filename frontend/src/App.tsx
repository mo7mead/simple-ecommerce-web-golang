import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from '@mui/material'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Layout from './Layout'
import AdminLayout from './AdminLayout'
import SellerLayout from './SellerLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminSessions from './pages/admin/Sessions'
import AdminSettings from './pages/admin/Settings'
import AdminSlides from './pages/admin/Slides'
import AdminCategories from './pages/admin/Categories'
import AdminBranding from './pages/admin/Branding'
import AdminFlashSales from './pages/admin/FlashSales'
import AdminBrands from './pages/admin/Brands'
import SellerDashboard from './pages/seller/Dashboard'
import SellerProducts from './pages/seller/Products'
import SellerProductCreate from './pages/seller/ProductCreate'
import AdminProducts from './pages/admin/Products'

function Protected({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  if (role && user.role !== role) return <Box sx={{ p: 4 }}>Forbidden.</Box>
  return <>{children}</>
}

function Loading() {
  return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>
}

function ThemedApp() {
  const { settings, loading } = useAuth()
  const theme = createTheme({
    palette: { primary: { main: settings?.accentColor || '#4ea1ff' }, background: { default: '#f7f8fa' } },
    shape: { borderRadius: 10 },
    typography: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  })
  if (loading) return <Loading />

  const adminPage = (el: React.ReactNode) => <Protected role="admin"><AdminLayout>{el}</AdminLayout></Protected>
  const sellerPage = (el: React.ReactNode) => <Protected role="seller"><SellerLayout>{el}</SellerLayout></Protected>

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/admin/dashboard" element={adminPage(<AdminDashboard />)} />
        <Route path="/admin/users" element={adminPage(<AdminUsers />)} />
        <Route path="/admin/sessions" element={adminPage(<AdminSessions />)} />
        <Route path="/admin/settings" element={adminPage(<AdminSettings />)} />
        <Route path="/admin/slides" element={adminPage(<AdminSlides />)} />
        <Route path="/admin/categories" element={adminPage(<AdminCategories />)} />
        <Route path="/admin/branding" element={adminPage(<AdminBranding />)} />
        <Route path="/admin/flash-sales" element={adminPage(<AdminFlashSales />)} />
        <Route path="/admin/brands" element={adminPage(<AdminBrands />)} />
        <Route path="/admin/products" element={adminPage(<AdminProducts />)} />
        <Route path="/admin/*" element={adminPage(<Navigate to="/admin/dashboard" replace />)} />

        <Route path="/seller/dashboard" element={sellerPage(<SellerDashboard />)} />
        <Route path="/seller/products" element={sellerPage(<SellerProducts />)} />
        <Route path="/seller/products/create" element={sellerPage(<SellerProductCreate />)} />
        <Route path="/seller/*" element={sellerPage(<Navigate to="/seller/dashboard" replace />)} />

        <Route path="*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="*" element={<Box sx={{ p: 4 }}>Page not found.</Box>} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </ThemeProvider>
  )
}

export default function App() {
  return <BrowserRouter><AuthProvider><ThemedApp /></AuthProvider></BrowserRouter>
}
