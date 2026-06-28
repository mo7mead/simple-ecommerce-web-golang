package api

import (
	"net/http"
	"strings"
	"time"

	"smple-web-app/internal/store"
)

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
		writeErr(w, http.StatusInternalServerError, "internal error")
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
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large")
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	website := strings.TrimSpace(r.FormValue("website"))
	if name == "" {
		writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	var logoPath string
	if file, header, err := r.FormFile("logo"); err == nil && header.Size > 0 {
		defer file.Close()
		logoPath, err = a.saveImage(file, header.Filename, "brands")
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if err := a.Store.CreateBrand(r.Context(), name, logoPath, website); err != nil {
		if logoPath != "" {
			a.deleteUpload(logoPath)
		}
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminBrandDelete(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	path, err := a.Store.DeleteBrand(r.Context(), body.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	a.deleteUpload(path)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
