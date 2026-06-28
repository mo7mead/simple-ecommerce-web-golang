package api

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
)

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
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	if body.Username == "" || body.Password == "" {
		writeErr(w, http.StatusBadRequest, "username and password required")
		return
	}
	u, err := a.Store.Authenticate(r.Context(), body.Username, body.Password)
	if errors.Is(err, store.ErrInvalidCredentials) {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		log.Printf("login: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	token, expiresAt, err := a.Store.CreateSession(r.Context(), u.ID)
	if err != nil {
		log.Printf("create session: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: middleware.SessionCookie, Value: token, Path: "/",
		Expires: expiresAt, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]any{"user": toUserDTO(u)})
}

func (a *API) register(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	if len(body.Username) < 3 {
		writeErr(w, http.StatusBadRequest, "username must be at least 3 characters")
		return
	}
	if len(body.Password) < 4 {
		writeErr(w, http.StatusBadRequest, "password must be at least 4 characters")
		return
	}
	u, err := a.Store.CreateUser(r.Context(), body.Username, body.Password, store.RoleBuyer)
	if errors.Is(err, store.ErrUsernameTaken) {
		writeErr(w, http.StatusConflict, "username already taken")
		return
	}
	if err != nil {
		log.Printf("register: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	token, expiresAt, err := a.Store.CreateSession(r.Context(), u.ID)
	if err != nil {
		log.Printf("register session: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
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
