package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type FlashSale struct {
	ID            int64
	ProductID     sql.NullInt64
	ProductName   string
	ProductSKU    string
	Title         string
	ImagePath     string
	OriginalPrice float64
	SalePrice     float64
	Stock         int
	Sold          int
	EndsAt        time.Time
	Position      int
	CreatedAt     time.Time
}

func (s *Store) ListFlashSales(ctx context.Context, activeOnly bool) ([]FlashSale, error) {
	q := `SELECT f.id, f.product_id, COALESCE(p.name,''), COALESCE(p.sku,''),
		         f.title, f.image_path, f.original_price, f.sale_price,
		         f.stock, f.sold, f.ends_at, f.position, f.created_at
	      FROM flash_sales f
	      LEFT JOIN products p ON p.id = f.product_id`
	if activeOnly {
		q += ` WHERE f.ends_at > NOW() AND f.stock > f.sold`
	}
	q += ` ORDER BY f.position, f.ends_at, f.id`
	rows, err := s.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var out []FlashSale
	for rows.Next() {
		var f FlashSale
		if err := rows.Scan(&f.ID, &f.ProductID, &f.ProductName, &f.ProductSKU,
			&f.Title, &f.ImagePath, &f.OriginalPrice, &f.SalePrice,
			&f.Stock, &f.Sold, &f.EndsAt, &f.Position, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *Store) CreateFlashSale(ctx context.Context, productID *int64, title, imagePath string,
	originalPrice, salePrice float64, stock int, endsAt time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO flash_sales (product_id, title, image_path, original_price, sale_price, stock, ends_at, position)
		 VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT next_pos FROM (SELECT MAX(position) + 1 AS next_pos FROM flash_sales) t), 1))`,
		productID, title, imagePath, originalPrice, salePrice, stock, endsAt)
	return err
}

func (s *Store) DeleteFlashSale(ctx context.Context, id int64) (string, error) {
	var imagePath string
	err := s.db.QueryRowContext(ctx, `SELECT image_path FROM flash_sales WHERE id = ?`, id).Scan(&imagePath)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("lookup: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM flash_sales WHERE id = ?`, id); err != nil {
		return "", fmt.Errorf("delete: %w", err)
	}
	return imagePath, nil
}
