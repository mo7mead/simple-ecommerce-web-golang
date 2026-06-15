package middleware

import (
	"context"
	"errors"
	"net/http"
	"time"

	"smple-web-app/internal/store"
)

type ctxKey int

const (
	userKey ctxKey = iota
	sessionStartKey
)

const SessionCookie = "session"

func WithSession(s *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(SessionCookie)
			if err != nil || c.Value == "" {
				next.ServeHTTP(w, r)
				return
			}
			u, started, err := s.UserForSession(r.Context(), c.Value)
			if errors.Is(err, store.ErrSessionNotFound) {
				http.SetCookie(w, &http.Cookie{Name: SessionCookie, Path: "/", MaxAge: -1})
				next.ServeHTTP(w, r)
				return
			}
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			ctx := context.WithValue(r.Context(), userKey, u)
			ctx = context.WithValue(ctx, sessionStartKey, started)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := UserFrom(r.Context()); !ok {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u, ok := UserFrom(r.Context())
			if !ok {
				http.Redirect(w, r, "/login", http.StatusSeeOther)
				return
			}
			for _, role := range roles {
				if u.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, "forbidden", http.StatusForbidden)
		})
	}
}

func UserFrom(ctx context.Context) (store.User, bool) {
	u, ok := ctx.Value(userKey).(store.User)
	return u, ok
}

func SessionAge(ctx context.Context) time.Duration {
	t, ok := ctx.Value(sessionStartKey).(time.Time)
	if !ok {
		return 0
	}
	return time.Since(t)
}
