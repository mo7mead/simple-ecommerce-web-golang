package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

const sessionTTL = 24 * time.Hour

type SessionInfo struct {
	Username   string
	AvatarPath string
	CreatedAt  time.Time
	ExpiresAt  time.Time
}

func (s *Store) CreateSession(ctx context.Context, userID int64) (token string, expiresAt time.Time, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", time.Time{}, fmt.Errorf("token: %w", err)
	}
	token = hex.EncodeToString(buf)
	expiresAt = time.Now().Add(sessionTTL)
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
		token, userID, expiresAt,
	)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("insert: %w", err)
	}
	return token, expiresAt, nil
}

func (s *Store) UserForSession(ctx context.Context, token string) (User, time.Time, error) {
	var u User
	var createdAt time.Time
	err := s.db.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.role, u.display_name, u.email, u.avatar_path, u.cover_path, u.created_at, s.created_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token = ? AND s.expires_at > NOW()`, token,
	).Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName, &u.Email, &u.AvatarPath, &u.CoverPath, &u.CreatedAt, &createdAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, time.Time{}, ErrSessionNotFound
	}
	if err != nil {
		return User{}, time.Time{}, fmt.Errorf("query: %w", err)
	}
	return u, createdAt, nil
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token = ?`, token)
	return err
}

func (s *Store) ListActiveSessions(ctx context.Context) ([]SessionInfo, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT u.username, u.avatar_path, s.created_at, s.expires_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.expires_at > NOW()
		ORDER BY s.created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var sessions []SessionInfo
	for rows.Next() {
		var si SessionInfo
		if err := rows.Scan(&si.Username, &si.AvatarPath, &si.CreatedAt, &si.ExpiresAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		sessions = append(sessions, si)
	}
	return sessions, rows.Err()
}

func (s *Store) PurgeExpiredSessions(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at <= NOW()`)
	return err
}
