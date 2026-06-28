package api

import (
	"errors"
	"net/http"
	"strings"

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
)

func (a *API) profileGet(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFrom(r.Context())
	fresh, err := a.Store.FindUser(r.Context(), u.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileUpdate(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		DisplayName string `json:"displayName"`
		Email       string `json:"email"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.UpdateProfile(r.Context(), u.ID, strings.TrimSpace(body.DisplayName), strings.TrimSpace(body.Email), ""); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileAvatar(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil || header.Size == 0 {
		writeErr(w, http.StatusBadRequest, "no file")
		return
	}
	defer file.Close()
	webPath, err := a.saveImage(file, header.Filename, "avatars")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	old := u.AvatarPath
	if err := a.Store.UpdateProfile(r.Context(), u.ID, u.DisplayName, u.Email, webPath); err != nil {
		a.deleteUpload(webPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if old != "" && old != webPath {
		a.deleteUpload(old)
	}
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileAvatarDelete(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	path, _ := a.Store.ClearAvatar(r.Context(), u.ID)
	a.deleteUpload(path)
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileCover(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil || header.Size == 0 {
		writeErr(w, http.StatusBadRequest, "no file")
		return
	}
	defer file.Close()
	webPath, err := a.saveImage(file, header.Filename, "covers")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	old := u.CoverPath
	if err := a.Store.SetCover(r.Context(), u.ID, webPath); err != nil {
		a.deleteUpload(webPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if old != "" && old != webPath {
		a.deleteUpload(old)
	}
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profileCoverDelete(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	path, _ := a.Store.ClearCover(r.Context(), u.ID)
	a.deleteUpload(path)
	fresh, _ := a.Store.FindUser(r.Context(), u.ID)
	writeJSON(w, http.StatusOK, toUserDTO(fresh))
}

func (a *API) profilePassword(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if len(body.New) < 4 {
		writeErr(w, http.StatusBadRequest, "new password too short")
		return
	}
	err := a.Store.ChangePassword(r.Context(), u.ID, body.Current, body.New)
	if errors.Is(err, store.ErrInvalidCredentials) {
		writeErr(w, http.StatusUnauthorized, "current password incorrect")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
