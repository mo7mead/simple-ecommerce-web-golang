package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID          int64
	Username    string
	DisplayName string
	Email       string
	AvatarPath  string
	CoverPath   string
	Role        string
	CreatedAt   time.Time
}

func (s *Store) EnsureUser(ctx context.Context, username, password, role string) error {
	var exists int
	err := s.db.QueryRowContext(ctx, `SELECT 1 FROM users WHERE username = ?`, username).Scan(&exists)
	if err == nil {
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("lookup: %w", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash: %w", err)
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
		username, hash, role)
	return err
}

// CreateUser inserts a new user and returns it. Returns ErrUsernameTaken if
// the username is already in use.
func (s *Store) CreateUser(ctx context.Context, username, password, role string) (User, error) {
	var exists int
	err := s.db.QueryRowContext(ctx, `SELECT 1 FROM users WHERE username = ?`, username).Scan(&exists)
	if err == nil {
		return User{}, ErrUsernameTaken
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return User{}, fmt.Errorf("lookup: %w", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, fmt.Errorf("hash: %w", err)
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
		username, hash, role)
	if err != nil {
		return User{}, fmt.Errorf("insert: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return User{}, fmt.Errorf("last id: %w", err)
	}
	return s.FindUser(ctx, id)
}

func (s *Store) Authenticate(ctx context.Context, username, password string) (User, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var u User
	var hash []byte
	err := s.db.QueryRowContext(ctx,
		`SELECT id, username, password_hash, role, display_name, email, avatar_path, cover_path, created_at
		 FROM users WHERE username = ?`, username,
	).Scan(&u.ID, &u.Username, &hash, &u.Role, &u.DisplayName, &u.Email, &u.AvatarPath, &u.CoverPath, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, fmt.Errorf("query: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword(hash, []byte(password)); err != nil {
		return User{}, ErrInvalidCredentials
	}
	return u, nil
}

func (s *Store) FindUser(ctx context.Context, id int64) (User, error) {
	var u User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, username, role, display_name, email, avatar_path, cover_path, created_at
		 FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName, &u.Email, &u.AvatarPath, &u.CoverPath, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("query: %w", err)
	}
	return u, nil
}

func (s *Store) UpdateProfile(ctx context.Context, id int64, displayName, email, avatarPath string) error {
	if avatarPath != "" {
		_, err := s.db.ExecContext(ctx,
			`UPDATE users SET display_name = ?, email = ?, avatar_path = ? WHERE id = ?`,
			displayName, email, avatarPath, id)
		return err
	}
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET display_name = ?, email = ? WHERE id = ?`,
		displayName, email, id)
	return err
}

func (s *Store) ClearAvatar(ctx context.Context, id int64) (string, error) {
	var path string
	err := s.db.QueryRowContext(ctx, `SELECT avatar_path FROM users WHERE id = ?`, id).Scan(&path)
	if err != nil {
		return "", err
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE users SET avatar_path = '' WHERE id = ?`, id); err != nil {
		return "", err
	}
	return path, nil
}

func (s *Store) SetCover(ctx context.Context, id int64, coverPath string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET cover_path = ? WHERE id = ?`, coverPath, id)
	return err
}

func (s *Store) ClearCover(ctx context.Context, id int64) (string, error) {
	var path string
	err := s.db.QueryRowContext(ctx, `SELECT cover_path FROM users WHERE id = ?`, id).Scan(&path)
	if err != nil {
		return "", err
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE users SET cover_path = '' WHERE id = ?`, id); err != nil {
		return "", err
	}
	return path, nil
}

func (s *Store) ChangePassword(ctx context.Context, id int64, current, newPass string) error {
	var hash []byte
	err := s.db.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id = ?`, id).Scan(&hash)
	if err != nil {
		return fmt.Errorf("lookup: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword(hash, []byte(current)); err != nil {
		return ErrInvalidCredentials
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPass), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash: %w", err)
	}
	_, err = s.db.ExecContext(ctx, `UPDATE users SET password_hash = ? WHERE id = ?`, newHash, id)
	return err
}

func (s *Store) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, username, role, display_name, email, avatar_path, created_at FROM users ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName, &u.Email, &u.AvatarPath, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		users = append(users, u)
	}
	return users, rows.Err()
}
