package api

import "net/http"

func (a *API) settings(w http.ResponseWriter, r *http.Request) {
	s, err := a.Store.Settings(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
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
