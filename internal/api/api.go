package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
)

const maxUploadBytes = 5 << 20

var allowedImageExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
}

type API struct {
	Store     *store.Store
	UploadDir string
}

func Register(mux *http.ServeMux, st *store.Store, uploadDir string) {
	a := &API{Store: st, UploadDir: uploadDir}
	session := middleware.WithSession(st)
	auth := func(h http.HandlerFunc) http.Handler { return session(middleware.RequireUser(h)) }
	adminOnly := func(h http.HandlerFunc) http.Handler {
		return session(middleware.RequireRole(store.RoleAdmin)(h))
	}
	sellerOnly := func(h http.HandlerFunc) http.Handler {
		return session(middleware.RequireRole(store.RoleSeller)(h))
	}

	// ---- Public / session-aware ----
	mux.Handle("/api/login", session(http.HandlerFunc(a.login)))
	mux.Handle("/api/register", session(http.HandlerFunc(a.register)))
	mux.Handle("/api/logout", session(http.HandlerFunc(a.logout)))
	mux.Handle("/api/me", session(http.HandlerFunc(a.me)))
	mux.Handle("/api/settings", session(http.HandlerFunc(a.settings)))
	mux.Handle("/api/categories", session(http.HandlerFunc(a.categories)))
	mux.Handle("/api/slides", session(http.HandlerFunc(a.slides)))
	mux.Handle("/api/flash-sales", session(http.HandlerFunc(a.flashSales)))
	mux.Handle("/api/brands", session(http.HandlerFunc(a.brands)))
	mux.Handle("/api/products", session(http.HandlerFunc(a.publicProducts)))
	mux.Handle("/api/search", session(http.HandlerFunc(a.search)))

	// ---- Authenticated user ----
	mux.Handle("/api/orders", auth(a.userOrders))
	mux.Handle("/api/orders/create", auth(a.orderCreate))
	mux.Handle("/api/profile", auth(a.profileGet))
	mux.Handle("/api/profile/update", auth(a.profileUpdate))
	mux.Handle("/api/profile/password", auth(a.profilePassword))
	mux.Handle("/api/profile/avatar", auth(a.profileAvatar))
	mux.Handle("/api/profile/avatar-delete", auth(a.profileAvatarDelete))
	mux.Handle("/api/profile/cover", auth(a.profileCover))
	mux.Handle("/api/profile/cover-delete", auth(a.profileCoverDelete))

	mux.Handle("/api/addresses", auth(a.addresses))
	mux.Handle("/api/addresses/{id}", auth(a.addressByID))
	mux.Handle("POST /api/addresses/{id}/default", auth(a.addressDefault))

	// ---- Admin ----
	mux.Handle("/api/admin/stats", adminOnly(a.adminStats))
	mux.Handle("/api/admin/users", adminOnly(a.adminUsers))
	mux.Handle("/api/admin/sessions", adminOnly(a.adminSessions))
	mux.Handle("/api/admin/system", adminOnly(a.adminSystem))
	mux.Handle("/api/admin/slides", adminOnly(a.adminSlides))
	mux.Handle("/api/admin/slides/delete", adminOnly(a.adminSlideDelete))
	mux.Handle("/api/admin/slides/reorder", adminOnly(a.adminSlideReorder))
	mux.Handle("/api/admin/categories", adminOnly(a.adminCategories))
	mux.Handle("/api/admin/categories/delete", adminOnly(a.adminCategoryDelete))
	mux.Handle("/api/admin/branding", adminOnly(a.adminBranding))
	mux.Handle("/api/admin/branding/logo-delete", adminOnly(a.adminLogoDelete))
	mux.Handle("/api/admin/flash-sales", adminOnly(a.adminFlashSales))
	mux.Handle("/api/admin/flash-sales/delete", adminOnly(a.adminFlashSaleDelete))
	mux.Handle("/api/admin/brands", adminOnly(a.adminBrands))
	mux.Handle("/api/admin/brands/delete", adminOnly(a.adminBrandDelete))
	mux.Handle("/api/admin/products", adminOnly(a.adminProducts))
	mux.Handle("/api/admin/products/approve", adminOnly(a.adminProductApprove))
	mux.Handle("/api/admin/products/reject", adminOnly(a.adminProductReject))
	mux.Handle("/api/admin/products/status", adminOnly(a.adminProductSetStatus))
	mux.Handle("/api/admin/products/bulk-status", adminOnly(a.adminProductBulkStatus))
	mux.Handle("/api/admin/notifications", adminOnly(a.adminNotifications))
	mux.Handle("/api/admin/notifications/read", adminOnly(a.adminNotificationsRead))
	mux.Handle("/api/admin/notifications/stream", adminOnly(a.adminNotificationsStream))
	mux.Handle("/api/admin/payments", adminOnly(a.adminPayments))
	mux.Handle("/api/admin/orders", adminOnly(a.adminOrders))
	mux.Handle("/api/admin/orders/status", adminOnly(a.adminOrderStatus))
	mux.Handle("GET /api/admin/order/{ref}", adminOnly(a.adminOrderByRef))

	// ---- Seller ----
	mux.Handle("/api/seller/stats", sellerOnly(a.sellerStats))
	mux.Handle("/api/seller/products", sellerOnly(a.sellerProducts))
	mux.Handle("/api/seller/products/create", sellerOnly(a.sellerProductCreate))
	mux.Handle("/api/seller/products/delete", sellerOnly(a.sellerProductDelete))
	mux.Handle("/api/seller/orders", sellerOnly(a.sellerOrders))
	mux.Handle("/api/seller/notifications", sellerOnly(a.sellerNotifications))
	mux.Handle("/api/seller/notifications/read", sellerOnly(a.sellerNotificationsRead))

	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))
}

// ---- Shared helpers ----

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encode: %v", err)
	}
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func readJSON(r *http.Request, v any) error {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}

func methodAllowed(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method == method {
		return true
	}
	writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	return false
}

func (a *API) saveImage(src io.Reader, originalName, subdir string) (string, error) {
	ext := strings.ToLower(filepath.Ext(originalName))
	if !allowedImageExt[ext] {
		return "", fmt.Errorf("unsupported image type (use JPG, PNG, GIF, or WEBP)")
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate name: %w", err)
	}
	filename := hex.EncodeToString(buf) + ext
	dir := filepath.Join(a.UploadDir, subdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create dir: %w", err)
	}
	dst, err := os.Create(filepath.Join(dir, filename))
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()
	if _, err := io.Copy(dst, io.LimitReader(src, maxUploadBytes)); err != nil {
		_ = os.Remove(dst.Name())
		return "", fmt.Errorf("write file: %w", err)
	}
	return "/uploads/" + subdir + "/" + filename, nil
}

func (a *API) deleteUpload(webPath string) {
	if webPath == "" {
		return
	}
	rel := strings.TrimPrefix(webPath, "/uploads/")
	if rel == webPath || rel == "" || strings.Contains(rel, "..") {
		return
	}
	if err := os.Remove(filepath.Join(a.UploadDir, rel)); err != nil && !os.IsNotExist(err) {
		log.Printf("delete upload %s: %v", webPath, err)
	}
}
