package handler

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

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
	"smple-web-app/internal/view"
)

const maxUploadBytes = 5 << 20 // 5 MiB

var allowedImageExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true,
}

type deps struct {
	views     *view.Views
	store     *store.Store
	uploadDir string
}

func Register(mux *http.ServeMux, views *view.Views, st *store.Store, uploadDir string) {
	d := &deps{views: views, store: st, uploadDir: uploadDir}
	session := middleware.WithSession(st)
	requireUser := func(h http.HandlerFunc) http.Handler {
		return session(middleware.RequireUser(h))
	}
	requireRole := func(role string, h http.HandlerFunc) http.Handler {
		return session(middleware.RequireRole(role)(h))
	}

	mux.Handle("/", session(http.HandlerFunc(d.home)))
	mux.Handle("/about", session(d.textHandler(view.Page{
		Title: "About", Active: "about",
		Body: "A minimal Go HTTP server with a navigation bar.",
	})))
	mux.Handle("/contact", session(d.textHandler(view.Page{
		Title: "Contact", Active: "contact",
		Body: "Reach out at hankora0x0@gmail.com.",
	})))
	mux.Handle("/login", session(http.HandlerFunc(d.login)))
	mux.Handle("/logout", session(http.HandlerFunc(d.logout)))
	mux.Handle("/c/", session(http.HandlerFunc(d.category)))
	mux.Handle("/search", session(http.HandlerFunc(d.search)))

	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))

	mux.Handle("/admin", requireUser(d.adminIndex))
	mux.Handle("/admin/", requireUser(d.adminIndex))
	mux.Handle("/admin/dashboard", requireRole(store.RoleAdmin, d.adminDashboard))
	mux.Handle("/admin/users", requireRole(store.RoleAdmin, d.adminUsers))
	mux.Handle("/admin/sessions", requireRole(store.RoleAdmin, d.adminSessions))
	mux.Handle("/admin/settings", requireRole(store.RoleAdmin, d.adminSettings))
	mux.Handle("/admin/slides", requireRole(store.RoleAdmin, d.adminSlides))
	mux.Handle("/admin/slides/delete", requireRole(store.RoleAdmin, d.adminSlideDelete))
	mux.Handle("/admin/slides/reorder", requireRole(store.RoleAdmin, d.adminSlideReorder))
	mux.Handle("/admin/categories", requireRole(store.RoleAdmin, d.adminCategories))
	mux.Handle("/admin/categories/delete", requireRole(store.RoleAdmin, d.adminCategoryDelete))
	mux.Handle("/admin/branding", requireRole(store.RoleAdmin, d.adminBranding))
	mux.Handle("/admin/branding/logo-delete", requireRole(store.RoleAdmin, d.adminLogoDelete))

	mux.Handle("/seller", requireUser(d.sellerIndex))
	mux.Handle("/seller/", requireUser(d.sellerIndex))
	mux.Handle("/seller/dashboard", requireRole(store.RoleSeller, d.sellerDashboard))
	mux.Handle("/seller/products", requireRole(store.RoleSeller, d.sellerProducts))
	mux.Handle("/seller/products/delete", requireRole(store.RoleSeller, d.sellerProductDelete))
}

func (d *deps) home(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	slides, err := d.store.ListSlides(r.Context())
	if err != nil {
		log.Printf("list slides: %v", err)
	}
	d.render(w, r, "home", view.Page{
		Title:     "Welcome",
		Active:    "home",
		GoVersion: runtime.Version()[2:],
		Slides:    slides,
	})
}

func (d *deps) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	results, err := d.store.Search(r.Context(), q)
	if err != nil {
		log.Printf("search: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	title := "Search"
	if q != "" {
		title = "Search: " + q
	}
	d.render(w, r, "search", view.Page{
		Title: title, Active: "search", Search: &results,
	})
}

func (d *deps) category(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/c/")
	if slug == "" || strings.ContainsAny(slug, "/") {
		http.NotFound(w, r)
		return
	}
	cat, err := d.store.FindCategoryBySlug(r.Context(), slug)
	if errors.Is(err, store.ErrNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		log.Printf("find category: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	children, err := d.store.ListChildren(r.Context(), cat.ID)
	if err != nil {
		log.Printf("list children: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	crumbs, err := d.store.CategoryAncestors(r.Context(), cat.ID)
	if err != nil {
		log.Printf("ancestors: %v", err)
		crumbs = []store.Category{cat}
	}
	d.render(w, r, "category", view.Page{
		Title:    cat.Name,
		Active:   "cat:" + cat.Slug,
		Category: &cat,
		Children: children,
		Crumbs:   crumbs,
	})
}

func (d *deps) textHandler(page view.Page) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		d.render(w, r, "text", page)
	}
}

func (d *deps) login(w http.ResponseWriter, r *http.Request) {
	if u, ok := middleware.UserFrom(r.Context()); ok {
		http.Redirect(w, r, homeForRole(u.Role), http.StatusSeeOther)
		return
	}

	page := view.Page{Title: "Login", Active: "login"}
	switch r.Method {
	case http.MethodGet:
		d.render(w, r, "login", page)
	case http.MethodPost:
		username := r.FormValue("username")
		password := r.FormValue("password")
		page.Username = username

		if username == "" || password == "" {
			page.Error = "Username and password are required."
			d.render(w, r, "login", page)
			return
		}
		user, err := d.store.Authenticate(r.Context(), username, password)
		if errors.Is(err, store.ErrInvalidCredentials) {
			page.Error = "Invalid credentials."
			d.render(w, r, "login", page)
			return
		}
		if err != nil {
			log.Printf("authenticate: %v", err)
			page.Error = "Sign in failed, try again."
			d.render(w, r, "login", page)
			return
		}
		token, expiresAt, err := d.store.CreateSession(r.Context(), user.ID)
		if err != nil {
			log.Printf("create session: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     middleware.SessionCookie,
			Value:    token,
			Path:     "/",
			Expires:  expiresAt,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
		http.Redirect(w, r, homeForRole(user.Role), http.StatusSeeOther)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func homeForRole(role string) string {
	switch role {
	case store.RoleSeller:
		return "/seller/dashboard"
	default:
		return "/admin/dashboard"
	}
}

func (d *deps) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(middleware.SessionCookie); err == nil {
		_ = d.store.DeleteSession(r.Context(), c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: middleware.SessionCookie, Path: "/", MaxAge: -1})
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (d *deps) adminIndex(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	http.Redirect(w, r, homeForRole(u.Role), http.StatusSeeOther)
}

func (d *deps) adminDashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := d.store.Stats(r.Context(), middleware.SessionAge(r.Context()))
	if err != nil {
		log.Printf("stats: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	d.render(w, r, "admin/dashboard", view.Page{
		Title: "Dashboard", Active: "dashboard", Stats: &stats,
	})
}

func (d *deps) adminUsers(w http.ResponseWriter, r *http.Request) {
	users, err := d.store.ListUsers(r.Context())
	if err != nil {
		log.Printf("list users: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	d.render(w, r, "admin/users", view.Page{
		Title: "Users", Active: "users", Users: users,
	})
}

func (d *deps) adminSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := d.store.ListActiveSessions(r.Context())
	if err != nil {
		log.Printf("list sessions: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	d.render(w, r, "admin/sessions", view.Page{
		Title: "Sessions", Active: "sessions", Sessions: sessions,
	})
}

func (d *deps) adminSettings(w http.ResponseWriter, r *http.Request) {
	d.render(w, r, "admin/settings", view.Page{
		Title: "Settings", Active: "settings", GoVersion: runtime.Version(),
	})
}

func (d *deps) adminSlides(w http.ResponseWriter, r *http.Request) {
	page := view.Page{Title: "Home slides", Active: "slides"}

	if r.Method == http.MethodPost {
		if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
			page.Error = "Upload too large or malformed."
		} else {
			title := strings.TrimSpace(r.FormValue("title"))
			body := strings.TrimSpace(r.FormValue("body"))
			file, header, err := r.FormFile("image")
			switch {
			case title == "":
				page.Error = "Title is required."
			case err != nil:
				page.Error = "An image file is required."
			default:
				defer file.Close()
				webPath, saveErr := d.saveUploadedImage(file, header.Filename, "sliders")
				if saveErr != nil {
					log.Printf("save upload: %v", saveErr)
					page.Error = saveErr.Error()
				} else if err := d.store.CreateSlide(r.Context(), title, body, webPath); err != nil {
					log.Printf("create slide: %v", err)
					page.Error = "Could not save the slide."
				} else {
					http.Redirect(w, r, "/admin/slides", http.StatusSeeOther)
					return
				}
			}
		}
	}

	slides, err := d.store.ListSlides(r.Context())
	if err != nil {
		log.Printf("list slides: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	page.Slides = slides
	d.render(w, r, "admin/slides", page)
}

func (d *deps) adminSlideDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id, err := strconv.ParseInt(r.FormValue("id"), 10, 64)
	if err == nil {
		imagePath, err := d.store.DeleteSlide(r.Context(), id)
		if err != nil {
			log.Printf("delete slide: %v", err)
		} else if imagePath != "" {
			// imagePath is "/uploads/<file>"; remove on-disk file.
			if name := strings.TrimPrefix(imagePath, "/uploads/"); name != imagePath && name != "" {
				_ = os.Remove(filepath.Join(d.uploadDir, name))
			}
		}
	}
	http.Redirect(w, r, "/admin/slides", http.StatusSeeOther)
}

func (d *deps) adminCategories(w http.ResponseWriter, r *http.Request) {
	page := view.Page{Title: "Categories", Active: "categories"}

	if r.Method == http.MethodPost {
		name := r.FormValue("name")
		icon := strings.TrimSpace(r.FormValue("icon"))
		var parentID *int64
		if raw := r.FormValue("parent_id"); raw != "" {
			if id, err := strconv.ParseInt(raw, 10, 64); err == nil {
				parentID = &id
			}
		}
		if err := d.store.CreateCategory(r.Context(), parentID, name, icon); err != nil {
			log.Printf("create category: %v", err)
			page.Error = "Could not add category: " + err.Error()
		} else {
			http.Redirect(w, r, "/admin/categories", http.StatusSeeOther)
			return
		}
	}

	tree, err := d.store.CategoryTree(r.Context())
	if err != nil {
		log.Printf("category tree: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	flat, err := d.store.ListCategories(r.Context())
	if err != nil {
		log.Printf("list categories: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	page.Categories = tree
	page.FlatCats = flat
	d.render(w, r, "admin/categories", page)
}

func (d *deps) adminBranding(w http.ResponseWriter, r *http.Request) {
	page := view.Page{Title: "Branding", Active: "branding"}

	if r.Method == http.MethodPost {
		if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
			page.Error = "Upload too large or malformed."
		} else {
			siteName := strings.TrimSpace(r.FormValue("site_name"))
			tagline := strings.TrimSpace(r.FormValue("tagline"))
			if siteName == "" {
				page.Error = "Site name is required."
			} else {
				_ = d.store.SetSetting(r.Context(), "site_name", siteName)
				_ = d.store.SetSetting(r.Context(), "tagline", tagline)
				if file, header, err := r.FormFile("logo"); err == nil && header.Size > 0 {
					defer file.Close()
					webPath, saveErr := d.saveUploadedImage(file, header.Filename, "branding")
					if saveErr != nil {
						page.Error = saveErr.Error()
					} else {
						_ = d.store.SetSetting(r.Context(), "logo_path", webPath)
					}
				}
				if page.Error == "" {
					http.Redirect(w, r, "/admin/branding", http.StatusSeeOther)
					return
				}
			}
		}
	}

	site, err := d.store.Settings(r.Context())
	if err != nil {
		log.Printf("settings: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	page.Site = site
	d.render(w, r, "admin/branding", page)
}

func (d *deps) adminLogoDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	site, _ := d.store.Settings(r.Context())
	if site.LogoPath != "" {
		_ = d.store.SetSetting(r.Context(), "logo_path", "")
		if name := strings.TrimPrefix(site.LogoPath, "/uploads/"); name != site.LogoPath && name != "" {
			_ = os.Remove(filepath.Join(d.uploadDir, name))
		}
	}
	http.Redirect(w, r, "/admin/branding", http.StatusSeeOther)
}

func (d *deps) adminCategoryDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id, err := strconv.ParseInt(r.FormValue("id"), 10, 64)
	if err == nil {
		if err := d.store.DeleteCategory(r.Context(), id); err != nil {
			log.Printf("delete category: %v", err)
		}
	}
	http.Redirect(w, r, "/admin/categories", http.StatusSeeOther)
}

func (d *deps) adminSlideReorder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := d.store.ReorderSlides(r.Context(), body.IDs); err != nil {
		log.Printf("reorder slides: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (d *deps) saveUploadedImage(src io.Reader, originalName, subdir string) (string, error) {
	ext := strings.ToLower(filepath.Ext(originalName))
	if !allowedImageExt[ext] {
		return "", fmt.Errorf("unsupported image type (use JPG, PNG, GIF, or WEBP)")
	}
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate name: %w", err)
	}
	filename := hex.EncodeToString(buf) + ext
	dir := filepath.Join(d.uploadDir, subdir)
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

func (d *deps) sellerIndex(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	http.Redirect(w, r, homeForRole(u.Role), http.StatusSeeOther)
}

func (d *deps) sellerDashboard(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	stats, err := d.store.SellerStats(r.Context(), u.ID)
	if err != nil {
		log.Printf("seller stats: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	d.render(w, r, "seller/dashboard", view.Page{
		Title: "Dashboard", Active: "dashboard", SellerStats: &stats,
	})
}

func (d *deps) sellerProducts(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	page := view.Page{Title: "Products", Active: "products"}

	if r.Method == http.MethodPost {
		name := r.FormValue("name")
		price, errP := strconv.ParseFloat(r.FormValue("price"), 64)
		stock, errS := strconv.Atoi(r.FormValue("stock"))
		switch {
		case name == "":
			page.Error = "Product name is required."
		case errP != nil || price < 0:
			page.Error = "Price must be a non-negative number."
		case errS != nil || stock < 0:
			page.Error = "Stock must be a non-negative integer."
		default:
			if err := d.store.CreateProduct(r.Context(), u.ID, name, price, stock); err != nil {
				log.Printf("create product: %v", err)
				page.Error = "Could not save the product."
			} else {
				http.Redirect(w, r, "/seller/products", http.StatusSeeOther)
				return
			}
		}
	}

	products, err := d.store.ListProducts(r.Context(), u.ID)
	if err != nil {
		log.Printf("list products: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	page.Products = products
	d.render(w, r, "seller/products", page)
}

func (d *deps) sellerProductDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	id, err := strconv.ParseInt(r.FormValue("id"), 10, 64)
	if err == nil {
		if err := d.store.DeleteProduct(r.Context(), u.ID, id); err != nil {
			log.Printf("delete product: %v", err)
		}
	}
	http.Redirect(w, r, "/seller/products", http.StatusSeeOther)
}

func (d *deps) render(w http.ResponseWriter, r *http.Request, name string, p view.Page) {
	if p.User == nil {
		if u, ok := middleware.UserFrom(r.Context()); ok {
			p.User = &u
		}
	}
	if !strings.Contains(name, "/") && p.Categories == nil {
		if tree, err := d.store.CategoryTree(r.Context()); err == nil {
			p.Categories = tree
		} else {
			log.Printf("category tree (render): %v", err)
		}
	}
	if p.Site.SiteName == "" {
		if site, err := d.store.Settings(r.Context()); err == nil {
			p.Site = site
		}
	}
	if err := d.views.Render(w, name, p); err != nil {
		log.Printf("render %s: %v", name, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}
