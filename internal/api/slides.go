package api

import (
	"net/http"
	"strings"
)

func (a *API) slides(w http.ResponseWriter, r *http.Request) {
	slides, err := a.Store.ListSlides(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, slides)
}

func (a *API) adminSlides(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		slides, err := a.Store.ListSlides(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, slides)
		return
	}
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large")
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	body := strings.TrimSpace(r.FormValue("body"))
	if title == "" {
		writeErr(w, http.StatusBadRequest, "title required")
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil || header.Size == 0 {
		writeErr(w, http.StatusBadRequest, "image required")
		return
	}
	defer file.Close()
	webPath, err := a.saveImage(file, header.Filename, "sliders")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.Store.CreateSlide(r.Context(), title, body, webPath); err != nil {
		a.deleteUpload(webPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminSlideDelete(w http.ResponseWriter, r *http.Request) {
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
	path, err := a.Store.DeleteSlide(r.Context(), body.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	a.deleteUpload(path)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminSlideReorder(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.ReorderSlides(r.Context(), body.IDs); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
