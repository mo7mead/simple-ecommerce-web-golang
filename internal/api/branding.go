package api

import (
	"net/http"
	"strings"
)

func (a *API) adminBranding(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s, _ := a.Store.Settings(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{
			"siteName": s.SiteName, "tagline": s.Tagline, "logoPath": s.LogoPath, "accentColor": s.AccentColor,
		})
		return
	}
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large")
		return
	}
	siteName := strings.TrimSpace(r.FormValue("siteName"))
	tagline := strings.TrimSpace(r.FormValue("tagline"))
	accent := strings.TrimSpace(r.FormValue("accentColor"))
	if siteName == "" {
		writeErr(w, http.StatusBadRequest, "site name required")
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
	if !methodAllowed(w, r, http.MethodPost) {
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
