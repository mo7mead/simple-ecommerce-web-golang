package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Product struct {
	ID             int64
	SellerID       int64
	SellerUsername string
	SKU            string
	Name           string
	Description    string
	ImagePath      string
	Price          float64
	Stock          int
	ShippingDays   int
	CategoryID     sql.NullInt64
	CategoryName   string
	BrandID        sql.NullInt64
	BrandName      string
	Status         string
	ReviewNote     string
	CreatedAt      time.Time
}

const (
	ProductPending  = "pending"
	ProductApproved = "approved"
	ProductRejected = "rejected"
)

type CreateProductInput struct {
	Name         string
	Description  string
	ImagePath    string
	Price        float64
	Stock        int
	ShippingDays int
	CategoryID   *int64
	BrandID      *int64
	AutoApprove  bool
}

const productSelect = `SELECT p.id, p.seller_id, u.username, p.sku, p.name, p.description, p.image_path,
		p.price, p.stock, p.shipping_days, p.category_id, COALESCE(c.name,''),
		p.brand_id, COALESCE(b.name,''),
		p.status, p.review_note, p.created_at
	FROM products p
	JOIN users u ON u.id = p.seller_id
	LEFT JOIN categories c ON c.id = p.category_id
	LEFT JOIN brands b ON b.id = p.brand_id`

func scanProductRows(rows *sql.Rows) ([]Product, error) {
	var out []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.SellerID, &p.SellerUsername, &p.SKU, &p.Name, &p.Description, &p.ImagePath,
			&p.Price, &p.Stock, &p.ShippingDays, &p.CategoryID, &p.CategoryName,
			&p.BrandID, &p.BrandName, &p.Status, &p.ReviewNote, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ListProducts returns the seller's own catalog (all statuses).
func (s *Store) ListProducts(ctx context.Context, sellerID int64) ([]Product, error) {
	rows, err := s.db.QueryContext(ctx, productSelect+` WHERE p.seller_id = ? ORDER BY p.id DESC`, sellerID)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	return scanProductRows(rows)
}

// ListProductsByStatus lists every product matching the given status (admin queue).
// Pass empty string for "all".
func (s *Store) ListProductsByStatus(ctx context.Context, status string) ([]Product, error) {
	q := productSelect
	args := []any{}
	if status != "" {
		q += ` WHERE p.status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY p.created_at DESC, p.id DESC`
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	return scanProductRows(rows)
}

// Crockford-style alphabet — no easily confused glyphs (0/O, 1/I).
var skuAlphabet = []byte("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

func generateSKU() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i, b := range buf {
		buf[i] = skuAlphabet[int(b)%len(skuAlphabet)]
	}
	return "Z1-" + string(buf), nil
}

func (s *Store) uniqueSKU(ctx context.Context) (string, error) {
	for i := 0; i < 8; i++ {
		sku, err := generateSKU()
		if err != nil {
			return "", err
		}
		var exists int
		err = s.db.QueryRowContext(ctx, `SELECT 1 FROM products WHERE sku = ?`, sku).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return sku, nil
		}
		if err != nil {
			return "", fmt.Errorf("sku lookup: %w", err)
		}
	}
	return "", fmt.Errorf("could not generate unique SKU")
}

// CreateProduct creates a product with an auto-generated SKU. Status defaults
// to "pending" unless AutoApprove is set (admin-created products).
// Pending submissions also create an admin-audience notification.
func (s *Store) CreateProduct(ctx context.Context, sellerID int64, in CreateProductInput) (string, error) {
	sku, err := s.uniqueSKU(ctx)
	if err != nil {
		return "", err
	}
	status := ProductPending
	if in.AutoApprove {
		status = ProductApproved
	}
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO products (seller_id, sku, name, description, image_path, price, stock,
			shipping_days, category_id, brand_id, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sellerID, sku, in.Name, in.Description, in.ImagePath, in.Price, in.Stock,
		in.ShippingDays, in.CategoryID, in.BrandID, status)
	if err != nil {
		return "", fmt.Errorf("insert: %w", err)
	}
	if status == ProductPending {
		productID, _ := res.LastInsertId()
		seller, _ := s.FindUser(ctx, sellerID)
		sellerName := seller.DisplayName
		if sellerName == "" {
			sellerName = seller.Username
		}
		_ = s.CreateNotification(ctx, Notification{
			Audience:  "admin",
			Kind:      "product_created",
			Title:     "New product awaiting review",
			Body:      fmt.Sprintf("%s submitted %q (SKU %s).", sellerName, in.Name, sku),
			Link:      "/admin/products",
			RelatedID: sql.NullInt64{Int64: productID, Valid: productID > 0},
		})
	}
	return sku, nil
}

func (s *Store) DeleteProduct(ctx context.Context, sellerID, productID int64) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM products WHERE id = ? AND seller_id = ?`, productID, sellerID)
	return err
}

func (s *Store) ApproveProduct(ctx context.Context, productID int64) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE products SET status = ?, review_note = '' WHERE id = ? AND status = ?`,
		ProductApproved, productID, ProductPending)
	if err != nil {
		return fmt.Errorf("approve: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RejectProduct(ctx context.Context, productID int64, note string) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE products SET status = ?, review_note = ? WHERE id = ? AND status = ?`,
		ProductRejected, note, productID, ProductPending)
	if err != nil {
		return fmt.Errorf("reject: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// BulkSetProductStatus applies the same status (and optional note for rejections)
// to a slice of product IDs in a single round trip. Returns how many rows changed.
func (s *Store) BulkSetProductStatus(ctx context.Context, ids []int64, status, note string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	switch status {
	case ProductPending, ProductApproved, ProductRejected:
	default:
		return 0, fmt.Errorf("invalid status %q", status)
	}
	if status != ProductRejected {
		note = ""
	}
	placeholders := make([]string, len(ids))
	args := make([]any, 0, len(ids)+2)
	args = append(args, status, note)
	for i, id := range ids {
		placeholders[i] = "?"
		args = append(args, id)
	}
	q := fmt.Sprintf(
		`UPDATE products SET status = ?, review_note = ? WHERE id IN (%s)`,
		strings.Join(placeholders, ","),
	)
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk set status: %w", err)
	}
	n, _ := res.RowsAffected()
	return n, nil
}

// SetProductStatus changes a product's status to any of pending/approved/rejected.
// Unlike Approve/Reject, it does not require the current status to be pending.
func (s *Store) SetProductStatus(ctx context.Context, productID int64, status, note string) error {
	switch status {
	case ProductPending, ProductApproved, ProductRejected:
	default:
		return fmt.Errorf("invalid status %q", status)
	}
	if status != ProductRejected {
		note = ""
	}
	res, err := s.db.ExecContext(ctx,
		`UPDATE products SET status = ?, review_note = ? WHERE id = ?`,
		status, note, productID)
	if err != nil {
		return fmt.Errorf("set status: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
