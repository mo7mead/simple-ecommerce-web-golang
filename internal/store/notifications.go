package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type Notification struct {
	ID        int64
	Audience  string
	Kind      string
	Title     string
	Body      string
	Link      string
	RelatedID sql.NullInt64
	ReadAt    sql.NullTime
	CreatedAt time.Time
}

type notifSub struct {
	ch       chan Notification
	audience string
}

// SubscribeNotifications registers a buffered channel that receives every new
// notification whose audience matches (empty filter = all audiences). The
// returned cancel must be called to release resources.
func (s *Store) SubscribeNotifications(audience string, buf int) (<-chan Notification, func()) {
	if buf <= 0 {
		buf = 16
	}
	sub := &notifSub{ch: make(chan Notification, buf), audience: audience}
	s.notifMu.Lock()
	s.notifSubs = append(s.notifSubs, sub)
	s.notifMu.Unlock()
	return sub.ch, func() {
		s.notifMu.Lock()
		defer s.notifMu.Unlock()
		for i, x := range s.notifSubs {
			if x == sub {
				s.notifSubs = append(s.notifSubs[:i], s.notifSubs[i+1:]...)
				close(sub.ch)
				return
			}
		}
	}
}

func (s *Store) publishNotification(n Notification) {
	s.notifMu.Lock()
	defer s.notifMu.Unlock()
	for _, sub := range s.notifSubs {
		if sub.audience != "" && sub.audience != n.Audience {
			continue
		}
		// non-blocking: drop on slow consumer to keep the publisher fast.
		select {
		case sub.ch <- n:
		default:
		}
	}
}

func (s *Store) CreateNotification(ctx context.Context, n Notification) error {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO notifications (audience, kind, title, body, link, related_id)
		VALUES (?, ?, ?, ?, ?, ?)`,
		n.Audience, n.Kind, n.Title, n.Body, n.Link, n.RelatedID)
	if err != nil {
		return fmt.Errorf("notify insert: %w", err)
	}
	if id, err := res.LastInsertId(); err == nil {
		n.ID = id
		n.CreatedAt = time.Now()
		s.publishNotification(n)
	}
	return nil
}

// ListNotifications returns the most recent notifications for an audience
// plus the unread count. Limit caps how many rows are returned.
func (s *Store) ListNotifications(ctx context.Context, audience string, limit int) ([]Notification, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, audience, kind, title, body, link, related_id, read_at, created_at
		FROM notifications
		WHERE audience = ?
		ORDER BY created_at DESC
		LIMIT ?`, audience, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()
	out := make([]Notification, 0, limit)
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Audience, &n.Kind, &n.Title, &n.Body, &n.Link,
			&n.RelatedID, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, n)
	}
	var unread int
	if err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notifications WHERE audience = ? AND read_at IS NULL`,
		audience).Scan(&unread); err != nil {
		return nil, 0, err
	}
	return out, unread, nil
}

// MarkNotificationsRead marks all notifications for the audience as read; if
// ids is non-empty, only those IDs are marked. Returns rows affected.
func (s *Store) MarkNotificationsRead(ctx context.Context, audience string, ids []int64) (int64, error) {
	if len(ids) == 0 {
		res, err := s.db.ExecContext(ctx,
			`UPDATE notifications SET read_at = NOW() WHERE audience = ? AND read_at IS NULL`,
			audience)
		if err != nil {
			return 0, fmt.Errorf("mark all read: %w", err)
		}
		n, _ := res.RowsAffected()
		return n, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, 0, len(ids)+1)
	args = append(args, audience)
	for i, id := range ids {
		placeholders[i] = "?"
		args = append(args, id)
	}
	q := fmt.Sprintf(
		`UPDATE notifications SET read_at = NOW() WHERE audience = ? AND read_at IS NULL AND id IN (%s)`,
		strings.Join(placeholders, ","))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("mark ids read: %w", err)
	}
	n, _ := res.RowsAffected()
	return n, nil
}
