package api

import "net/http"

func (a *API) adminSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := a.Store.ListActiveSessions(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]map[string]any, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, map[string]any{
			"username":   s.Username,
			"avatarPath": s.AvatarPath,
			"createdAt":  s.CreatedAt,
			"expiresAt":  s.ExpiresAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}
