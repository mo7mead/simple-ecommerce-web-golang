package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
)

type addressDTO struct {
	ID        int64     `json:"id"`
	Label     string    `json:"label"`
	Recipient string    `json:"recipient"`
	Phone     string    `json:"phone"`
	Line      string    `json:"line"`
	IsDefault bool      `json:"isDefault"`
	CreatedAt time.Time `json:"createdAt"`
}

func toAddressDTO(a store.Address) addressDTO {
	return addressDTO{a.ID, a.Label, a.Recipient, a.Phone, a.Line, a.IsDefault, a.CreatedAt}
}

func (a *API) addresses(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	switch r.Method {
	case http.MethodGet:
		list, err := a.Store.ListAddresses(r.Context(), u.ID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		out := make([]addressDTO, 0, len(list))
		for _, ad := range list {
			out = append(out, toAddressDTO(ad))
		}
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		in, ok := readAddressInput(w, r)
		if !ok {
			return
		}
		ad, err := a.Store.CreateAddress(r.Context(), u.ID, in)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, toAddressDTO(ad))
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *API) addressByID(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	id, ok := parsePathID(w, r, "id")
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodPut, http.MethodPost:
		in, ok := readAddressInput(w, r)
		if !ok {
			return
		}
		ad, err := a.Store.UpdateAddress(r.Context(), u.ID, id, in)
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, toAddressDTO(ad))
	case http.MethodDelete:
		if err := a.Store.DeleteAddress(r.Context(), u.ID, id); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				writeErr(w, http.StatusNotFound, "not found")
				return
			}
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *API) addressDefault(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	id, ok := parsePathID(w, r, "id")
	if !ok {
		return
	}
	if err := a.Store.SetDefaultAddress(r.Context(), u.ID, id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func readAddressInput(w http.ResponseWriter, r *http.Request) (store.AddressInput, bool) {
	var body struct {
		Label     string `json:"label"`
		Recipient string `json:"recipient"`
		Phone     string `json:"phone"`
		Line      string `json:"line"`
		IsDefault bool   `json:"isDefault"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return store.AddressInput{}, false
	}
	in := store.AddressInput{
		Label:     strings.TrimSpace(body.Label),
		Recipient: strings.TrimSpace(body.Recipient),
		Phone:     strings.TrimSpace(body.Phone),
		Line:      strings.TrimSpace(body.Line),
		IsDefault: body.IsDefault,
	}
	if in.Recipient == "" || in.Phone == "" || in.Line == "" {
		writeErr(w, http.StatusBadRequest, "recipient, phone, and address are required")
		return store.AddressInput{}, false
	}
	return in, true
}

func parsePathID(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return 0, false
	}
	return id, true
}
