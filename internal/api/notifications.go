package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
)

type notificationDTO struct {
	ID        int64      `json:"id"`
	Kind      string     `json:"kind"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	Link      string     `json:"link"`
	RelatedID *int64     `json:"relatedId"`
	ReadAt    *time.Time `json:"readAt"`
	CreatedAt time.Time  `json:"createdAt"`
}

func toNotificationDTO(n store.Notification) notificationDTO {
	dto := notificationDTO{
		ID: n.ID, Kind: n.Kind, Title: n.Title, Body: n.Body, Link: n.Link,
		CreatedAt: n.CreatedAt,
	}
	if n.RelatedID.Valid {
		v := n.RelatedID.Int64
		dto.RelatedID = &v
	}
	if n.ReadAt.Valid {
		v := n.ReadAt.Time
		dto.ReadAt = &v
	}
	return dto
}

func (a *API) adminNotifications(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodGet) {
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	notifs, unread, err := a.Store.ListNotifications(r.Context(), "admin", limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]notificationDTO, 0, len(notifs))
	for _, n := range notifs {
		out = append(out, toNotificationDTO(n))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "unread": unread})
}

func (a *API) adminNotificationsStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch, cancel := a.Store.SubscribeNotifications("admin", 32)
	defer cancel()

	// Initial comment so the client knows the stream is live.
	if _, err := fmt.Fprintf(w, ": connected\n\n"); err != nil {
		return
	}
	flusher.Flush()

	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-heartbeat.C:
			if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case n, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(toNotificationDTO(n))
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "event: notification\ndata: %s\n\n", data); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (a *API) sellerNotifications(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodGet) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	audience := fmt.Sprintf("seller:%d", u.ID)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	notifs, unread, err := a.Store.ListNotifications(r.Context(), audience, limit)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]notificationDTO, 0, len(notifs))
	for _, n := range notifs {
		out = append(out, toNotificationDTO(n))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "unread": unread})
}

func (a *API) sellerNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		IDs []int64 `json:"ids"`
	}
	_ = readJSON(r, &body)
	n, err := a.Store.MarkNotificationsRead(r.Context(), fmt.Sprintf("seller:%d", u.ID), body.IDs)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "marked": n})
}

func (a *API) adminNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		IDs []int64 `json:"ids"`
	}
	_ = readJSON(r, &body)
	n, err := a.Store.MarkNotificationsRead(r.Context(), "admin", body.IDs)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "marked": n})
}
