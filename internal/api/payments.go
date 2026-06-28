package api

import (
	"net/http"
	"strconv"
)

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
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		CodEnabled  bool    `json:"codEnabled"`
		CodFee      float64 `json:"codFee"`
		ShippingFee float64 `json:"shippingFee"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if body.CodFee < 0 || body.ShippingFee < 0 {
		writeErr(w, http.StatusBadRequest, "fees must be non-negative")
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
