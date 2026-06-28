package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

type Category struct {
	ID       int64
	ParentID sql.NullInt64
	Name     string
	Slug     string
	Icon     string
	Position int
	Children []*Category
}

func Slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			dash = false
		case b.Len() > 0 && !dash:
			b.WriteByte('-')
			dash = true
		}
	}
	out := strings.TrimRight(b.String(), "-")
	if out == "" {
		out = "category"
	}
	return out
}

func (s *Store) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, parent_id, name, slug, icon, position FROM categories ORDER BY parent_id, position, id`)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var cats []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Icon, &c.Position); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func (s *Store) CategoryTree(ctx context.Context) ([]*Category, error) {
	cats, err := s.ListCategories(ctx)
	if err != nil {
		return nil, err
	}
	byID := make(map[int64]*Category, len(cats))
	for i := range cats {
		byID[cats[i].ID] = &cats[i]
	}
	var roots []*Category
	for i := range cats {
		c := &cats[i]
		if c.ParentID.Valid {
			if p, ok := byID[c.ParentID.Int64]; ok {
				p.Children = append(p.Children, c)
				continue
			}
		}
		roots = append(roots, c)
	}
	return roots, nil
}

func (s *Store) CreateCategory(ctx context.Context, parentID *int64, name, icon string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name is required")
	}
	base := Slugify(name)
	slug := base
	for n := 2; ; n++ {
		var exists int
		err := s.db.QueryRowContext(ctx, `SELECT 1 FROM categories WHERE slug = ?`, slug).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			break
		}
		if err != nil {
			return fmt.Errorf("slug check: %w", err)
		}
		slug = fmt.Sprintf("%s-%d", base, n)
	}
	var nextPos int
	scope := `parent_id IS NULL`
	args := []any{}
	if parentID != nil {
		scope = `parent_id = ?`
		args = append(args, *parentID)
	}
	if err := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(position), 0) + 1 FROM categories WHERE `+scope, args...,
	).Scan(&nextPos); err != nil {
		return fmt.Errorf("next position: %w", err)
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO categories (parent_id, name, slug, icon, position) VALUES (?, ?, ?, ?, ?)`,
		parentID, name, slug, icon, nextPos)
	return err
}

func (s *Store) FindCategoryBySlug(ctx context.Context, slug string) (Category, error) {
	var c Category
	err := s.db.QueryRowContext(ctx,
		`SELECT id, parent_id, name, slug, icon, position FROM categories WHERE slug = ?`, slug,
	).Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Icon, &c.Position)
	if errors.Is(err, sql.ErrNoRows) {
		return Category{}, ErrNotFound
	}
	if err != nil {
		return Category{}, fmt.Errorf("find slug: %w", err)
	}
	return c, nil
}

func (s *Store) ListChildren(ctx context.Context, parentID int64) ([]Category, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, parent_id, name, slug, icon, position FROM categories WHERE parent_id = ? ORDER BY position, id`,
		parentID)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var out []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Icon, &c.Position); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CategoryAncestors(ctx context.Context, id int64) ([]Category, error) {
	var out []Category
	cur := id
	for i := 0; i < 16; i++ {
		var c Category
		err := s.db.QueryRowContext(ctx,
			`SELECT id, parent_id, name, slug, icon, position FROM categories WHERE id = ?`, cur,
		).Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Icon, &c.Position)
		if errors.Is(err, sql.ErrNoRows) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("ancestor: %w", err)
		}
		out = append([]Category{c}, out...)
		if !c.ParentID.Valid {
			break
		}
		cur = c.ParentID.Int64
	}
	return out, nil
}

func (s *Store) DeleteCategory(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM categories WHERE id = ?`, id)
	return err
}
