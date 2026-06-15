package view

import (
	"embed"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"path"
	"strings"
	"time"

	"smple-web-app/internal/store"
)

//go:embed templates/layouts/*.html templates/partials/*.html templates/pages/*.html templates/pages/admin/*.html templates/pages/seller/*.html
var files embed.FS

type Views struct {
	pages map[string]*template.Template
}

type Page struct {
	Title     string
	Active    string
	Body      string
	Username  string
	Error     string
	User      *store.User
	Stats     *store.Stats
	Users       []store.User
	Sessions    []store.SessionInfo
	Products    []store.Product
	SellerStats *store.SellerStats
	Slides      []store.Slide
	Categories  []*store.Category
	FlatCats    []store.Category
	Category    *store.Category
	Children    []store.Category
	Crumbs      []store.Category
	Site        store.Settings
	Search      *store.SearchResults
	GoVersion   string
}

func Load() (*Views, error) {
	funcs := template.FuncMap{
		"fmtTime": func(t time.Time) string { return t.Format("2006-01-02 15:04:05") },
		"fmtDur":  fmtDur,
		"repeat":  strings.Repeat,
	}

	pages := make(map[string]*template.Template)
	err := fs.WalkDir(files, "templates/pages", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(p, ".html") {
			return err
		}
		layout := "templates/layouts/public.html"
		key := strings.TrimSuffix(strings.TrimPrefix(p, "templates/pages/"), ".html")
		switch {
		case strings.HasPrefix(key, "admin/"):
			layout = "templates/layouts/admin.html"
		case strings.HasPrefix(key, "seller/"):
			layout = "templates/layouts/seller.html"
		}
		t, err := template.New(path.Base(p)).Funcs(funcs).ParseFS(files,
			layout, "templates/partials/styles.html", "templates/partials/cat.html", p)
		if err != nil {
			return fmt.Errorf("parse %s: %w", p, err)
		}
		pages[key] = t
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &Views{pages: pages}, nil
}

func (v *Views) Render(w io.Writer, name string, p Page) error {
	t, ok := v.pages[name]
	if !ok {
		return fmt.Errorf("unknown page %q", name)
	}
	return t.ExecuteTemplate(w, "layout", p)
}

func fmtDur(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	d = d.Round(time.Second)
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	sec := int(d.Seconds()) % 60
	if h > 0 {
		return fmt.Sprintf("%dh %dm", h, m)
	}
	if m > 0 {
		return fmt.Sprintf("%dm %ds", m, sec)
	}
	return fmt.Sprintf("%ds", sec)
}
