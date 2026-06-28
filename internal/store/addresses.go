package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type Address struct {
	ID        int64
	UserID    int64
	Label     string
	Recipient string
	Phone     string
	Line      string
	IsDefault bool
	CreatedAt time.Time
}

type AddressInput struct {
	Label     string
	Recipient string
	Phone     string
	Line      string
	IsDefault bool
}

func (s *Store) ListAddresses(ctx context.Context, userID int64) ([]Address, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, label, recipient, phone, line, is_default, created_at
		 FROM addresses WHERE user_id = ?
		 ORDER BY is_default DESC, id DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("query addresses: %w", err)
	}
	defer rows.Close()
	var out []Address
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.ID, &a.UserID, &a.Label, &a.Recipient, &a.Phone, &a.Line, &a.IsDefault, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan address: %w", err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) FindAddress(ctx context.Context, userID, id int64) (Address, error) {
	var a Address
	err := s.db.QueryRowContext(ctx,
		`SELECT id, user_id, label, recipient, phone, line, is_default, created_at
		 FROM addresses WHERE id = ? AND user_id = ?`, id, userID,
	).Scan(&a.ID, &a.UserID, &a.Label, &a.Recipient, &a.Phone, &a.Line, &a.IsDefault, &a.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Address{}, ErrNotFound
	}
	if err != nil {
		return Address{}, fmt.Errorf("find address: %w", err)
	}
	return a, nil
}

// CreateAddress inserts and returns the new address. When in.IsDefault is true
// (or there are no existing addresses) it is also promoted to the default.
func (s *Store) CreateAddress(ctx context.Context, userID int64, in AddressInput) (Address, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Address{}, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var existing int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM addresses WHERE user_id = ?`, userID).Scan(&existing); err != nil {
		return Address{}, fmt.Errorf("count: %w", err)
	}
	makeDefault := in.IsDefault || existing == 0
	if makeDefault {
		if _, err := tx.ExecContext(ctx, `UPDATE addresses SET is_default = 0 WHERE user_id = ?`, userID); err != nil {
			return Address{}, fmt.Errorf("clear default: %w", err)
		}
	}

	res, err := tx.ExecContext(ctx,
		`INSERT INTO addresses (user_id, label, recipient, phone, line, is_default)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		userID, in.Label, in.Recipient, in.Phone, in.Line, makeDefault)
	if err != nil {
		return Address{}, fmt.Errorf("insert address: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Address{}, fmt.Errorf("last id: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Address{}, fmt.Errorf("commit: %w", err)
	}
	return s.FindAddress(ctx, userID, id)
}

func (s *Store) UpdateAddress(ctx context.Context, userID, id int64, in AddressInput) (Address, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Address{}, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx,
		`UPDATE addresses SET label = ?, recipient = ?, phone = ?, line = ?
		 WHERE id = ? AND user_id = ?`,
		in.Label, in.Recipient, in.Phone, in.Line, id, userID)
	if err != nil {
		return Address{}, fmt.Errorf("update: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		// Either the row doesn't exist or no columns changed; check existence.
		var ok int
		err := tx.QueryRowContext(ctx, `SELECT 1 FROM addresses WHERE id = ? AND user_id = ?`, id, userID).Scan(&ok)
		if errors.Is(err, sql.ErrNoRows) {
			return Address{}, ErrNotFound
		}
		if err != nil {
			return Address{}, fmt.Errorf("verify: %w", err)
		}
	}
	if in.IsDefault {
		if _, err := tx.ExecContext(ctx,
			`UPDATE addresses SET is_default = (id = ?) WHERE user_id = ?`, id, userID); err != nil {
			return Address{}, fmt.Errorf("set default: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return Address{}, fmt.Errorf("commit: %w", err)
	}
	return s.FindAddress(ctx, userID, id)
}

// SetDefaultAddress makes the given address the user's default.
func (s *Store) SetDefaultAddress(ctx context.Context, userID, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var ok int
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM addresses WHERE id = ? AND user_id = ?`, id, userID).Scan(&ok)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("verify: %w", err)
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE addresses SET is_default = (id = ?) WHERE user_id = ?`, id, userID); err != nil {
		return fmt.Errorf("set default: %w", err)
	}
	return tx.Commit()
}

// DeleteAddress removes the address. If it was the default and other addresses
// remain, the next most recent one becomes the default.
func (s *Store) DeleteAddress(ctx context.Context, userID, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	var wasDefault bool
	err = tx.QueryRowContext(ctx, `SELECT is_default FROM addresses WHERE id = ? AND user_id = ?`, id, userID).Scan(&wasDefault)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lookup: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM addresses WHERE id = ? AND user_id = ?`, id, userID); err != nil {
		return fmt.Errorf("delete: %w", err)
	}
	if wasDefault {
		if _, err := tx.ExecContext(ctx,
			`UPDATE addresses SET is_default = 1 WHERE user_id = ?
			 ORDER BY id DESC LIMIT 1`, userID); err != nil {
			return fmt.Errorf("promote default: %w", err)
		}
	}
	return tx.Commit()
}
