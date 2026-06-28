package store

import (
	"context"
	"fmt"
	"strings"
)

type SearchResults struct {
	Query      string
	Categories []Category
	Products   []Product
}

func (s *Store) Search(ctx context.Context, q string) (SearchResults, error) {
	out := SearchResults{Query: q}
	q = strings.TrimSpace(q)
	if q == "" {
		return out, nil
	}
	like := "%" + strings.ReplaceAll(strings.ReplaceAll(q, "%", `\%`), "_", `\_`) + "%"

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, parent_id, name, slug, icon, position
		FROM categories WHERE name LIKE ? OR slug LIKE ?
		ORDER BY (name = ?) DESC, name LIMIT 50`, like, like, q)
	if err != nil {
		return out, fmt.Errorf("category search: %w", err)
	}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Icon, &c.Position); err != nil {
			rows.Close()
			return out, fmt.Errorf("category scan: %w", err)
		}
		out.Categories = append(out.Categories, c)
	}
	rows.Close()

	prows, err := s.db.QueryContext(ctx, `
		SELECT id, seller_id, name, price, stock, created_at
		FROM products WHERE name LIKE ? ORDER BY name LIMIT 50`, like)
	if err != nil {
		return out, fmt.Errorf("product search: %w", err)
	}
	defer prows.Close()
	for prows.Next() {
		var p Product
		if err := prows.Scan(&p.ID, &p.SellerID, &p.Name, &p.Price, &p.Stock, &p.CreatedAt); err != nil {
			return out, fmt.Errorf("product scan: %w", err)
		}
		out.Products = append(out.Products, p)
	}
	return out, prows.Err()
}
