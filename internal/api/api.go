package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

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

	mux.Handle("/api/login", session(http.HandlerFunc(a.login)))
	mux.Handle("/api/logout", session(http.HandlerFunc(a.logout)))
	mux.Handle("/api/me", session(http.HandlerFunc(a.me)))
	mux.Handle("/api/settings", session(http.HandlerFunc(a.settings)))
	mux.Handle("/api/categories", session(http.HandlerFunc(a.categories)))
	mux.Handle("/api/slides", session(http.HandlerFunc(a.slides)))
	mux.Handle("/api/flash-sales", session(http.HandlerFunc(a.flashSales)))
	mux.Handle("/api/brands", session(http.HandlerFunc(a.brands)))
	mux.Handle("/api/products", session(http.HandlerFunc(a.publicProducts)))
	mux.Handle("/api/search", session(http.HandlerFunc(a.search)))

	mux.Handle("/api/orders", auth(a.userOrders))
	mux.Handle("/api/orders/create", auth(a.orderCreate))

	mux.Handle("/api/profile", auth(a.profileGet))
	mux.Handle("/api/profile/update", auth(a.profileUpdate))
	mux.Handle("/api/profile/password", auth(a.profilePassword))
	mux.Handle("/api/profile/avatar", auth(a.profileAvatar))
	mux.Handle("/api/profile/avatar-delete", auth(a.profileAvatarDelete))
	mux.Handle("/api/profile/cover", auth(a.profileCover))
	mux.Handle("/api/profile/cover-delete", auth(a.profileCoverDelete))

	adminOnly := func(h http.HandlerFunc) http.Handler {
		return session(middleware.RequireRole(store.RoleAdmin)(h))
	}
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
	mux.Handle("/api/admin/flash-sales", adminOnly(a.adminFlashSales))
	mux.Handle("/api/admin/flash-sales/delete", adminOnly(a.adminFlashSaleDelete))
	mux.Handle("/api/admin/brands", adminOnly(a.adminBrands))
	mux.Handle("/api/admin/brands/delete", adminOnly(a.adminBrandDelete))
	mux.Handle("/api/admin/branding/logo-delete", adminOnly(a.adminLogoDelete))

	sellerOnly := func(h http.HandlerFunc) http.Handler {
		return session(middleware.RequireRole(store.RoleSeller)(h))
	}
	mux.Handle("/api/seller/stats", sellerOnly(a.sellerStats))
	mux.Handle("/api/seller/products", sellerOnly(a.sellerProducts))
	mux.Handle("/api/seller/products/create", sellerOnly(a.sellerProductCreate))
	mux.Handle("/api/seller/products/delete", sellerOnly(a.sellerProductDelete))

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

	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encode: %v", err)
	}
}

func readJSON(r *http.Request, v any) error {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}

type userDTO struct {
	ID          int64     `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	Email       string    `json:"email"`
	AvatarPath  string    `json:"avatarPath"`
	CoverPath   string    `json:"coverPath"`
	Role        string    `json:"role"`
	CreatedAt   time.Time `json:"createdAt"`
}

func toUserDTO(u store.User) userDTO {
	return userDTO{u.ID, u.Username, u.DisplayName, u.Email, u.AvatarPath, u.CoverPath, u.Role, u.CreatedAt}
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	if body.Username == "" || body.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username and password required"})
		return
	}
	u, err := a.Store.Authenticate(r.Context(), body.Username, body.Password)
	if errors.Is(err, store.ErrInvalidCredentials) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	if err != nil {
		log.Printf("login: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	token, expiresAt, err := a.Store.CreateSession(r.Context(), u.ID)
	if err != nil {
		log.Printf("create session: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: middleware.SessionCookie, Value: token, Path: "/",
		Expires: expiresAt, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]any{"user": toUserDTO(u)})
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(middleware.SessionCookie); err == nil {
		_ = a.Store.DeleteSession(r.Context(), c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: middleware.SessionCookie, Path: "/", MaxAge: -1})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) me(w http.ResponseWriter, r *http.Request) {
	u, ok := middleware.UserFrom(r.Context())
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toUserDTO(u)})
}

func (a *API) settings(w http.ResponseWriter, r *http.Request) {
	s, err := a.Store.Settings(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"siteName":    s.SiteName,
		"tagline":     s.Tagline,
		"logoPath":    s.LogoPath,
		"accentColor": s.AccentColor,
		"codEnabled":  s.CodEnabled,
		"codFee":      s.CodFee,
		"shippingFee": s.ShippingFee,
	})
}

type catNode struct {
	ID       int64      `json:"id"`
	ParentID *int64     `json:"parentId,omitempty"`
	Name     string     `json:"name"`
	Slug     string     `json:"slug"`
	Icon     string     `json:"icon"`
	Children []*catNode `json:"children,omitempty"`
}

func toCatNode(c *store.Category) *catNode {
	n := &catNode{ID: c.ID, Name: c.Name, Slug: c.Slug, Icon: c.Icon}
	if c.ParentID.Valid {
		pid := c.ParentID.Int64
		n.ParentID = &pid
	}
	for _, child := range c.Children {
		n.Children = append(n.Children, toCatNode(child))
	}
	return n
}

func (a *API) categories(w http.ResponseWriter, r *http.Request) {
	tree, err := a.Store.CategoryTree(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]*catNode, 0, len(tree))
	for _, c := range tree {
		out = append(out, toCatNode(c))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) slides(w http.ResponseWriter, r *http.Request) {
	slides, err := a.Store.ListSlides(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, slides)
}

type flashSaleDTO struct {
	ID            int64     `json:"id"`
	ProductID     *int64    `json:"productId"`
	ProductName   string    `json:"productName"`
	ProductSKU    string    `json:"productSku"`
	Title         string    `json:"title"`
	ImagePath     string    `json:"imagePath"`
	OriginalPrice float64   `json:"originalPrice"`
	SalePrice     float64   `json:"salePrice"`
	Stock         int       `json:"stock"`
	Sold          int       `json:"sold"`
	EndsAt        time.Time `json:"endsAt"`
	Position      int       `json:"position"`
	CreatedAt     time.Time `json:"createdAt"`
}

func toFlashSaleDTO(f store.FlashSale) flashSaleDTO {
	dto := flashSaleDTO{
		ID: f.ID, ProductName: f.ProductName, ProductSKU: f.ProductSKU,
		Title: f.Title, ImagePath: f.ImagePath,
		OriginalPrice: f.OriginalPrice, SalePrice: f.SalePrice,
		Stock: f.Stock, Sold: f.Sold,
		EndsAt: f.EndsAt, Position: f.Position, CreatedAt: f.CreatedAt,
	}
	if f.ProductID.Valid {
		v := f.ProductID.Int64
		dto.ProductID = &v
	}
	return dto
}

func (a *API) flashSales(w http.ResponseWriter, r *http.Request) {
	items, err := a.Store.ListFlashSales(r.Context(), true)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]flashSaleDTO, 0, len(items))
	for _, f := range items {
		out = append(out, toFlashSaleDTO(f))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminFlashSales(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		items, err := a.Store.ListFlashSales(r.Context(), false)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		out := make([]flashSaleDTO, 0, len(items))
		for _, f := range items {
			out = append(out, toFlashSaleDTO(f))
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload too large"})
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	productID, err := parseOptionalInt64(r.FormValue("productId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "product invalid"})
		return
	}
	if title == "" && productID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title or product required"})
		return
	}
	originalPrice, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("originalPrice")), 64)
	if err != nil || originalPrice < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "original price invalid"})
		return
	}
	salePrice, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("salePrice")), 64)
	if err != nil || salePrice < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sale price invalid"})
		return
	}
	if salePrice > originalPrice {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sale price must be ≤ original price"})
		return
	}
	stock, err := strconv.Atoi(strings.TrimSpace(r.FormValue("stock")))
	if err != nil || stock < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "stock invalid"})
		return
	}
	endsAtStr := strings.TrimSpace(r.FormValue("endsAt"))
	if endsAtStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "end time required"})
		return
	}
	endsAt, err := time.Parse(time.RFC3339, endsAtStr)
	if err != nil {
		// Allow datetime-local input (no timezone) — treat as local time.
		endsAt, err = time.ParseInLocation("2006-01-02T15:04", endsAtStr, time.Local)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "end time invalid"})
			return
		}
	}
	if endsAt.Before(time.Now()) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "end time must be in the future"})
		return
	}
	// Pull product details if linked, to allow the admin to inherit name/image.
	var productName, productImagePath string
	if productID != nil {
		products, perr := a.Store.ListProductsByStatus(r.Context(), store.ProductApproved)
		if perr == nil {
			for _, p := range products {
				if p.ID == *productID {
					productName = p.Name
					productImagePath = p.ImagePath
					break
				}
			}
			if productName == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "product not approved or not found"})
				return
			}
		}
	}

	var webPath string
	if file, header, err := r.FormFile("image"); err == nil && header.Size > 0 {
		defer file.Close()
		webPath, err = a.saveImage(file, header.Filename, "flash-sales")
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	} else if productImagePath != "" {
		webPath = productImagePath
	} else {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "image required"})
		return
	}

	if title == "" {
		title = productName
	}

	if err := a.Store.CreateFlashSale(r.Context(), productID, title, webPath, originalPrice, salePrice, stock, endsAt); err != nil {
		// Only delete uploads we created ourselves, never an inherited product image.
		if webPath != productImagePath {
			a.deleteUpload(webPath)
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminFlashSaleDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	path, err := a.Store.DeleteFlashSale(r.Context(), body.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if strings.HasPrefix(path, "/uploads/flash-sales/") {
		a.deleteUpload(path)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type brandDTO struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	LogoPath  string    `json:"logoPath"`
	Website   string    `json:"website"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"createdAt"`
}

func toBrandDTO(b store.Brand) brandDTO {
	return brandDTO{b.ID, b.Name, b.Slug, b.LogoPath, b.Website, b.Position, b.CreatedAt}
}

func (a *API) brands(w http.ResponseWriter, r *http.Request) {
	items, err := a.Store.ListBrands(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]brandDTO, 0, len(items))
	for _, b := range items {
		out = append(out, toBrandDTO(b))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminBrands(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		a.brands(w, r)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload too large"})
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	website := strings.TrimSpace(r.FormValue("website"))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}
	var logoPath string
	if file, header, err := r.FormFile("logo"); err == nil && header.Size > 0 {
		defer file.Close()
		logoPath, err = a.saveImage(file, header.Filename, "brands")
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}
	if err := a.Store.CreateBrand(r.Context(), name, logoPath, website); err != nil {
		if logoPath != "" {
			a.deleteUpload(logoPath)
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminBrandDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	path, err := a.Store.DeleteBrand(r.Context(), body.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	a.deleteUpload(path)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) publicProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	products, err := a.Store.ListProductsByStatus(r.Context(), store.ProductApproved)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]productDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toProductDTO(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	results, err := a.Store.Search(r.Context(), q)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (a *API) adminStats(w http.ResponseWriter, r *http.Request) {
	age := middleware.SessionAge(r.Context())
	stats, err := a.Store.Stats(r.Context(), age)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	recentSessions := make([]map[string]any, 0, len(stats.RecentSessions))
	for _, s := range stats.RecentSessions {
		recentSessions = append(recentSessions, map[string]any{
			"username":   s.Username,
			"avatarPath": s.AvatarPath,
			"createdAt":  s.CreatedAt,
			"expiresAt":  s.ExpiresAt,
		})
	}
	recentUsers := make([]userDTO, 0, len(stats.RecentUsers))
	for _, u := range stats.RecentUsers {
		recentUsers = append(recentUsers, toUserDTO(u))
	}
	recentProducts := make([]map[string]any, 0, len(stats.RecentProducts))
	for _, p := range stats.RecentProducts {
		recentProducts = append(recentProducts, map[string]any{
			"id":        p.ID,
			"name":      p.Name,
			"price":     p.Price,
			"stock":     p.Stock,
			"sellerId":  p.SellerID,
			"createdAt": p.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"totalUsers":      stats.TotalUsers,
		"totalAdmins":     stats.TotalAdmins,
		"totalSellers":    stats.TotalSellers,
		"activeSessions":  stats.ActiveSessions,
		"totalCategories": stats.TotalCategories,
		"totalSlides":     stats.TotalSlides,
		"totalProducts":   stats.TotalProducts,
		"inventoryValue":  stats.InventoryValue,
		"newUsers7d":      stats.NewUsers7d,
		"newProducts7d":   stats.NewProducts7d,
		"yourSessionSec":  int(age.Round(time.Second).Seconds()),
		"recentSessions":  recentSessions,
		"recentUsers":     recentUsers,
		"recentProducts":  recentProducts,
	})
}

func (a *API) profileGet(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	fresh, err := a.Store.FindUser(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		DisplayName string `json:"displayName"`
		Email       string `json:"email"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.UpdateProfile(r.Context(), u.ID, strings.TrimSpace(body.DisplayName), strings.TrimSpace(body.Email), ""); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileAvatar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload too large"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil || header.Size == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no file"})
		return
	}
	defer file.Close()
	webPath, err := a.saveImage(file, header.Filename, "avatars")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	old := u.AvatarPath
	if err := a.Store.UpdateProfile(r.Context(), u.ID, u.DisplayName, u.Email, webPath); err != nil {
		a.deleteUpload(webPath)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if old != "" && old != webPath {
		a.deleteUpload(old)
	}
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileAvatarDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	path, _ := a.Store.ClearAvatar(r.Context(), u.ID)
	a.deleteUpload(path)
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileCover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload too large"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil || header.Size == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no file"})
		return
	}
	defer file.Close()
	webPath, err := a.saveImage(file, header.Filename, "covers")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	old := u.CoverPath
	if err := a.Store.SetCover(r.Context(), u.ID, webPath); err != nil {
		a.deleteUpload(webPath)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if old != "" && old != webPath {
		a.deleteUpload(old)
	}
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileCoverDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	path, _ := a.Store.ClearCover(r.Context(), u.ID)
	a.deleteUpload(path)
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) adminUsers(w http.ResponseWriter, r *http.Request) {
	users, err := a.Store.ListUsers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]userDTO, 0, len(users))
	for _, u := range users {
		out = append(out, toUserDTO(u))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := a.Store.ListActiveSessions(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]map[string]any, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, map[string]any{
			"username":   s.Username,
			"avatarPath": s.AvatarPath,
			"createdAt":  s.CreatedAt,
			"expiresAt":  s.ExpiresAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminSystem(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"goVersion":  runtime.Version(),
		"sessionTTL": "24h",
		"db":         "MySQL",
	})
}

func (a *API) adminSlides(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		slides, err := a.Store.ListSlides(r.Context())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, http.StatusOK, slides)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload too large"})
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	body := strings.TrimSpace(r.FormValue("body"))
	if title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title required"})
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil || header.Size == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "image required"})
		return
	}
	defer file.Close()
	webPath, err := a.saveImage(file, header.Filename, "sliders")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := a.Store.CreateSlide(r.Context(), title, body, webPath); err != nil {
		a.deleteUpload(webPath)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminSlideDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	path, err := a.Store.DeleteSlide(r.Context(), body.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	a.deleteUpload(path)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminSlideReorder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.ReorderSlides(r.Context(), body.IDs); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		cats, err := a.Store.ListCategories(r.Context())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		out := make([]map[string]any, 0, len(cats))
		for _, c := range cats {
			var pid any
			if c.ParentID.Valid {
				pid = c.ParentID.Int64
			}
			out = append(out, map[string]any{
				"id": c.ID, "parentId": pid, "name": c.Name, "slug": c.Slug, "icon": c.Icon, "position": c.Position,
			})
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		Name     string `json:"name"`
		Icon     string `json:"icon"`
		ParentID *int64 `json:"parentId"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.CreateCategory(r.Context(), body.ParentID, body.Name, body.Icon); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminCategoryDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.DeleteCategory(r.Context(), body.ID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminBranding(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s, _ := a.Store.Settings(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{
			"siteName": s.SiteName, "tagline": s.Tagline, "logoPath": s.LogoPath, "accentColor": s.AccentColor,
		})
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload too large"})
		return
	}
	siteName := strings.TrimSpace(r.FormValue("siteName"))
	tagline := strings.TrimSpace(r.FormValue("tagline"))
	accent := strings.TrimSpace(r.FormValue("accentColor"))
	if siteName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "site name required"})
		return
	}
	_ = a.Store.SetSetting(r.Context(), "site_name", siteName)
	_ = a.Store.SetSetting(r.Context(), "tagline", tagline)
	if validHex(accent) || accent == "" {
		_ = a.Store.SetSetting(r.Context(), "accent_color", accent)
	}
	if file, header, err := r.FormFile("logo"); err == nil && header.Size > 0 {
		defer file.Close()
		webPath, saveErr := a.saveImage(file, header.Filename, "branding")
		if saveErr == nil {
			old, _ := a.Store.Settings(r.Context())
			if err := a.Store.SetSetting(r.Context(), "logo_path", webPath); err == nil {
				if old.LogoPath != "" && old.LogoPath != webPath {
					a.deleteUpload(old.LogoPath)
				}
			}
		}
	}
	s, _ := a.Store.Settings(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{
		"siteName": s.SiteName, "tagline": s.Tagline, "logoPath": s.LogoPath, "accentColor": s.AccentColor,
	})
}

func (a *API) adminLogoDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	s, _ := a.Store.Settings(r.Context())
	if s.LogoPath != "" {
		_ = a.Store.SetSetting(r.Context(), "logo_path", "")
		a.deleteUpload(s.LogoPath)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func validHex(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for _, r := range s[1:] {
		switch {
		case r >= '0' && r <= '9', r >= 'a' && r <= 'f', r >= 'A' && r <= 'F':
		default:
			return false
		}
	}
	return true
}

func (a *API) sellerStats(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	stats, err := a.Store.SellerStats(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

type productDTO struct {
	ID             int64     `json:"id"`
	SellerID       int64     `json:"sellerId"`
	SellerUsername string    `json:"sellerUsername"`
	SKU            string    `json:"sku"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	ImagePath      string    `json:"imagePath"`
	Price          float64   `json:"price"`
	Stock          int       `json:"stock"`
	ShippingDays   int       `json:"shippingDays"`
	CategoryID     *int64    `json:"categoryId"`
	CategoryName   string    `json:"categoryName"`
	BrandID        *int64    `json:"brandId"`
	BrandName      string    `json:"brandName"`
	Status         string    `json:"status"`
	ReviewNote     string    `json:"reviewNote"`
	CreatedAt      time.Time `json:"createdAt"`
}

func toProductDTO(p store.Product) productDTO {
	out := productDTO{
		ID: p.ID, SellerID: p.SellerID, SellerUsername: p.SellerUsername,
		SKU: p.SKU, Name: p.Name, Description: p.Description, ImagePath: p.ImagePath,
		Price: p.Price, Stock: p.Stock, ShippingDays: p.ShippingDays,
		CategoryName: p.CategoryName, BrandName: p.BrandName,
		Status: p.Status, ReviewNote: p.ReviewNote, CreatedAt: p.CreatedAt,
	}
	if p.CategoryID.Valid {
		v := p.CategoryID.Int64
		out.CategoryID = &v
	}
	if p.BrandID.Valid {
		v := p.BrandID.Int64
		out.BrandID = &v
	}
	return out
}

func (a *API) sellerProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	products, err := a.Store.ListProducts(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]productDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toProductDTO(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func parseOptionalInt64(s string) (*int64, error) {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return nil, nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (a *API) sellerProductCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "upload too large"})
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}
	price, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("price")), 64)
	if err != nil || price < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "price invalid"})
		return
	}
	stock, err := strconv.Atoi(strings.TrimSpace(r.FormValue("stock")))
	if err != nil || stock < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "stock invalid"})
		return
	}
	shippingDays, err := strconv.Atoi(strings.TrimSpace(r.FormValue("shippingDays")))
	if err != nil || shippingDays < 0 {
		shippingDays = 0
	}
	categoryID, err := parseOptionalInt64(r.FormValue("categoryId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "category invalid"})
		return
	}
	brandID, err := parseOptionalInt64(r.FormValue("brandId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "brand invalid"})
		return
	}
	description := strings.TrimSpace(r.FormValue("description"))

	var imagePath string
	if file, header, err := r.FormFile("image"); err == nil && header.Size > 0 {
		defer file.Close()
		imagePath, err = a.saveImage(file, header.Filename, "products")
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}

	in := store.CreateProductInput{
		Name: name, Description: description, ImagePath: imagePath,
		Price: price, Stock: stock, ShippingDays: shippingDays,
		CategoryID: categoryID, BrandID: brandID,
	}
	sku, err := a.Store.CreateProduct(r.Context(), u.ID, in)
	if err != nil {
		if imagePath != "" {
			a.deleteUpload(imagePath)
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "sku": sku, "status": store.ProductPending})
}

func (a *API) adminProducts(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "all" {
		status = ""
	}
	products, err := a.Store.ListProductsByStatus(r.Context(), status)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]productDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toProductDTO(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminProductApprove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct{ ID int64 `json:"id"` }
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.ApproveProduct(r.Context(), body.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not pending"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminProductReject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		ID   int64  `json:"id"`
		Note string `json:"note"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.RejectProduct(r.Context(), body.ID, strings.TrimSpace(body.Note)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not pending"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminProductSetStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.SetProductStatus(r.Context(), body.ID, strings.TrimSpace(body.Status), strings.TrimSpace(body.Note)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminProductBulkStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		IDs    []int64 `json:"ids"`
		Status string  `json:"status"`
		Note   string  `json:"note"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if len(body.IDs) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no ids"})
		return
	}
	if len(body.IDs) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "too many ids"})
		return
	}
	changed, err := a.Store.BulkSetProductStatus(r.Context(), body.IDs, strings.TrimSpace(body.Status), strings.TrimSpace(body.Note))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "changed": changed})
}

type notificationDTO struct {
	ID        int64     `json:"id"`
	Kind      string    `json:"kind"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Link      string    `json:"link"`
	RelatedID *int64    `json:"relatedId"`
	ReadAt    *time.Time `json:"readAt"`
	CreatedAt time.Time `json:"createdAt"`
}

func toNotificationDTO(n store.Notification) notificationDTO {
	dto := notificationDTO{
		ID: n.ID, Kind: n.Kind, Title: n.Title, Body: n.Body, Link: n.Link,
		CreatedAt: n.CreatedAt,
	}
	if n.RelatedID.Valid {
		v := n.RelatedID.Int64
		dto.RelatedID = &v
	}
	if n.ReadAt.Valid {
		v := n.ReadAt.Time
		dto.ReadAt = &v
	}
	return dto
}

func (a *API) adminNotifications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	notifs, unread, err := a.Store.ListNotifications(r.Context(), "admin", limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]notificationDTO, 0, len(notifs))
	for _, n := range notifs {
		out = append(out, toNotificationDTO(n))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "unread": unread})
}

func (a *API) adminNotificationsStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming unsupported"})
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch, cancel := a.Store.SubscribeNotifications("admin", 32)
	defer cancel()

	// Initial comment so the client knows the stream is live.
	if _, err := fmt.Fprintf(w, ": connected\n\n"); err != nil {
		return
	}
	flusher.Flush()

	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-heartbeat.C:
			if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case n, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(toNotificationDTO(n))
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "event: notification\ndata: %s\n\n", data); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (a *API) adminNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		IDs []int64 `json:"ids"`
	}
	_ = readJSON(r, &body)
	n, err := a.Store.MarkNotificationsRead(r.Context(), "admin", body.IDs)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "marked": n})
}

func (a *API) sellerProductDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.DeleteProduct(r.Context(), u.ID, body.ID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

var _ = strconv.Atoi

func (a *API) profilePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if len(body.New) < 4 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "new password too short"})
		return
	}
	err := a.Store.ChangePassword(r.Context(), u.ID, body.Current, body.New)
	if errors.Is(err, store.ErrInvalidCredentials) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "current password incorrect"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---- Payments (admin) ----

func (a *API) adminPayments(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s, _ := a.Store.Settings(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{
			"codEnabled":  s.CodEnabled,
			"codFee":      s.CodFee,
			"shippingFee": s.ShippingFee,
		})
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		CodEnabled  bool    `json:"codEnabled"`
		CodFee      float64 `json:"codFee"`
		ShippingFee float64 `json:"shippingFee"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if body.CodFee < 0 || body.ShippingFee < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "fees must be non-negative"})
		return
	}
	codFlag := "1"
	if !body.CodEnabled {
		codFlag = "0"
	}
	_ = a.Store.SetSetting(r.Context(), "cod_enabled", codFlag)
	_ = a.Store.SetSetting(r.Context(), "cod_fee", strconv.FormatFloat(body.CodFee, 'f', 2, 64))
	_ = a.Store.SetSetting(r.Context(), "shipping_fee", strconv.FormatFloat(body.ShippingFee, 'f', 2, 64))
	writeJSON(w, http.StatusOK, map[string]any{
		"codEnabled":  body.CodEnabled,
		"codFee":      body.CodFee,
		"shippingFee": body.ShippingFee,
	})
}

// ---- Orders ----

type orderItemDTO struct {
	ProductID int64   `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Qty       int     `json:"qty"`
	ImagePath string  `json:"imagePath"`
}

type orderDTO struct {
	ID            int64          `json:"id"`
	Ref           string         `json:"ref"`
	UserID        int64          `json:"userId"`
	Username      string         `json:"username"`
	CustomerName  string         `json:"customerName"`
	Phone         string         `json:"phone"`
	Address       string         `json:"address"`
	Items         []orderItemDTO `json:"items"`
	Subtotal      float64        `json:"subtotal"`
	ShippingFee   float64        `json:"shippingFee"`
	CodFee        float64        `json:"codFee"`
	Total         float64        `json:"total"`
	PaymentMethod string         `json:"paymentMethod"`
	Status        string         `json:"status"`
	CreatedAt     time.Time      `json:"createdAt"`
}

func toOrderDTO(o store.Order) orderDTO {
	items := make([]orderItemDTO, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, orderItemDTO{
			ProductID: it.ProductID, Name: it.Name, Price: it.Price,
			Qty: it.Qty, ImagePath: it.ImagePath,
		})
	}
	return orderDTO{
		ID: o.ID, Ref: o.Ref, UserID: o.UserID, Username: o.Username,
		CustomerName: o.CustomerName, Phone: o.Phone, Address: o.Address,
		Items:    items,
		Subtotal: o.Subtotal, ShippingFee: o.ShippingFee, CodFee: o.CodFee, Total: o.Total,
		PaymentMethod: o.PaymentMethod, Status: o.Status, CreatedAt: o.CreatedAt,
	}
}

func (a *API) userOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	orders, err := a.Store.ListUserOrders(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]orderDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, toOrderDTO(o))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) orderCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		CustomerName  string `json:"customerName"`
		Phone         string `json:"phone"`
		Address       string `json:"address"`
		PaymentMethod string `json:"paymentMethod"`
		Items         []struct {
			ProductID int64 `json:"productId"`
			Qty       int   `json:"qty"`
		} `json:"items"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	body.CustomerName = strings.TrimSpace(body.CustomerName)
	body.Phone = strings.TrimSpace(body.Phone)
	body.Address = strings.TrimSpace(body.Address)
	body.PaymentMethod = strings.TrimSpace(body.PaymentMethod)
	if body.CustomerName == "" || body.Phone == "" || body.Address == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name, phone, and address required"})
		return
	}
	if body.PaymentMethod == "" {
		body.PaymentMethod = "cod"
	}
	if len(body.Items) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cart is empty"})
		return
	}

	settings, err := a.Store.Settings(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	if body.PaymentMethod == "cod" && !settings.CodEnabled {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cash on delivery is disabled"})
		return
	}

	// Resolve products fresh from DB; never trust client prices/stock.
	allApproved, err := a.Store.ListProductsByStatus(r.Context(), store.ProductApproved)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	byID := make(map[int64]store.Product, len(allApproved))
	for _, p := range allApproved {
		byID[p.ID] = p
	}
	resolved := make([]store.OrderItem, 0, len(body.Items))
	var subtotal float64
	for _, it := range body.Items {
		p, ok := byID[it.ProductID]
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("product %d unavailable", it.ProductID)})
			return
		}
		if it.Qty <= 0 || it.Qty > p.Stock {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("invalid quantity for %s", p.Name)})
			return
		}
		resolved = append(resolved, store.OrderItem{
			ProductID: p.ID, Name: p.Name, Price: p.Price, Qty: it.Qty, ImagePath: p.ImagePath,
		})
		subtotal += p.Price * float64(it.Qty)
	}
	codFee := 0.0
	if body.PaymentMethod == "cod" {
		codFee = settings.CodFee
	}
	total := subtotal + settings.ShippingFee + codFee

	id, ref, err := a.Store.CreateOrder(r.Context(), store.CreateOrderInput{
		UserID:        u.ID,
		CustomerName:  body.CustomerName,
		Phone:         body.Phone,
		Address:       body.Address,
		Items:         resolved,
		Subtotal:      subtotal,
		ShippingFee:   settings.ShippingFee,
		CodFee:        codFee,
		Total:         total,
		PaymentMethod: body.PaymentMethod,
	})
	if err != nil {
		log.Printf("create order: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "id": id, "ref": ref, "subtotal": subtotal,
		"shippingFee": settings.ShippingFee, "codFee": codFee, "total": total,
	})
}

func (a *API) adminOrderByRef(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimSpace(r.PathValue("ref"))
	if ref == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ref required"})
		return
	}
	o, err := a.Store.FindOrderByRef(r.Context(), ref)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, toOrderDTO(o))
}

func (a *API) adminOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	orders, err := a.Store.ListAllOrders(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	out := make([]orderDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, toOrderDTO(o))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminOrderStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
	}
	if err := readJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad request"})
		return
	}
	if err := a.Store.SetOrderStatus(r.Context(), body.ID, strings.TrimSpace(body.Status)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
