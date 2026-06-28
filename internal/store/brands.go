package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Brand struct {
	ID        int64
	Name      string
	Slug      string
	LogoPath  string
	Website   string
	Position  int
	CreatedAt time.Time
}

func (s *Store) ListBrands(ctx context.Context) ([]Brand, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, slug, logo_path, website, position, created_at
		 FROM brands ORDER BY position, id`)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var out []Brand
	for rows.Next() {
		var b Brand
		if err := rows.Scan(&b.ID, &b.Name, &b.Slug, &b.LogoPath, &b.Website, &b.Position, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *Store) CreateBrand(ctx context.Context, name, logoPath, website string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name is required")
	}
	base := Slugify(name)
	slug := base
	for n := 2; ; n++ {
		var exists int
		err := s.db.QueryRowContext(ctx, `SELECT 1 FROM brands WHERE slug = ?`, slug).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			break
		}
		if err != nil {
			return fmt.Errorf("slug check: %w", err)
		}
		slug = fmt.Sprintf("%s-%d", base, n)
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO brands (name, slug, logo_path, website, position)
		 VALUES (?, ?, ?, ?, COALESCE((SELECT next_pos FROM (SELECT MAX(position) + 1 AS next_pos FROM brands) t), 1))`,
		name, slug, logoPath, website)
	return err
}

func (s *Store) DeleteBrand(ctx context.Context, id int64) (string, error) {
	var logoPath string
	err := s.db.QueryRowContext(ctx, `SELECT logo_path FROM brands WHERE id = ?`, id).Scan(&logoPath)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("lookup: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM brands WHERE id = ?`, id); err != nil {
		return "", fmt.Errorf("delete: %w", err)
	}
	return logoPath, nil
}
