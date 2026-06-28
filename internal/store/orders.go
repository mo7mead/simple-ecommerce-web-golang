package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type OrderItem struct {
	ProductID int64   `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Qty       int     `json:"qty"`
	ImagePath string  `json:"imagePath"`
}

type Order struct {
	ID            int64
	Ref           string
	UserID        int64
	Username      string
	CustomerName  string
	Phone         string
	Address       string
	Items         []OrderItem
	Subtotal      float64
	ShippingFee   float64
	CodFee        float64
	Total         float64
	PaymentMethod string
	Status        string
	CreatedAt     time.Time
}

// SellerOrder is an order projected to a single seller's view: items, customer,
// and subtotal are scoped to that seller only.
type SellerOrder struct {
	ID            int64
	Ref           string
	UserID        int64
	Username      string
	CustomerName  string
	Phone         string
	Address       string
	Items         []OrderItem
	Subtotal      float64
	PaymentMethod string
	Status        string
	CreatedAt     time.Time
}

type CreateOrderInput struct {
	UserID        int64
	CustomerName  string
	Phone         string
	Address       string
	Items         []OrderItem
	Subtotal      float64
	ShippingFee   float64
	CodFee        float64
	Total         float64
	PaymentMethod string
}

const orderSelectCols = `o.id, o.ref, o.user_id, COALESCE(u.username,''), o.customer_name, o.phone, o.address,
		o.items_json, o.subtotal, o.shipping_fee, o.cod_fee, o.total,
		o.payment_method, o.status, o.created_at`

func slugifySiteName(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		out = "ord"
	}
	if len(out) > 16 {
		out = out[:16]
	}
	return out
}

// uniqueOrderRef returns a human-friendly order reference like "zarttex-7HQ4ZP6L".
func (s *Store) uniqueOrderRef(ctx context.Context, siteName string) (string, error) {
	prefix := slugifySiteName(siteName)
	for i := 0; i < 8; i++ {
		buf := make([]byte, 4)
		if _, err := rand.Read(buf); err != nil {
			return "", fmt.Errorf("rand: %w", err)
		}
		ref := prefix + "-" + strings.ToUpper(hex.EncodeToString(buf))
		var n int
		err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM orders WHERE ref = ?`, ref).Scan(&n)
		if err != nil {
			return "", fmt.Errorf("check ref: %w", err)
		}
		if n == 0 {
			return ref, nil
		}
	}
	return "", fmt.Errorf("could not generate unique ref")
}

func (s *Store) CreateOrder(ctx context.Context, in CreateOrderInput) (int64, string, error) {
	itemsJSON, err := json.Marshal(in.Items)
	if err != nil {
		return 0, "", fmt.Errorf("marshal items: %w", err)
	}
	settings, _ := s.Settings(ctx)
	ref, err := s.uniqueOrderRef(ctx, settings.SiteName)
	if err != nil {
		return 0, "", err
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO orders (user_id, ref, customer_name, phone, address, items_json,
			subtotal, shipping_fee, cod_fee, total, payment_method, status)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
		in.UserID, ref, in.CustomerName, in.Phone, in.Address, string(itemsJSON),
		in.Subtotal, in.ShippingFee, in.CodFee, in.Total, in.PaymentMethod)
	if err != nil {
		return 0, "", fmt.Errorf("insert order: %w", err)
	}
	id, err := res.LastInsertId()
	return id, ref, err
}

func scanOrders(rows *sql.Rows) ([]Order, error) {
	var out []Order
	for rows.Next() {
		var o Order
		var itemsJSON string
		if err := rows.Scan(&o.ID, &o.Ref, &o.UserID, &o.Username, &o.CustomerName, &o.Phone, &o.Address,
			&itemsJSON, &o.Subtotal, &o.ShippingFee, &o.CodFee, &o.Total,
			&o.PaymentMethod, &o.Status, &o.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan order: %w", err)
		}
		_ = json.Unmarshal([]byte(itemsJSON), &o.Items)
		out = append(out, o)
	}
	return out, rows.Err()
}

func (s *Store) ListUserOrders(ctx context.Context, userID int64) ([]Order, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+orderSelectCols+`
		 FROM orders o LEFT JOIN users u ON u.id = o.user_id
		 WHERE o.user_id = ? ORDER BY o.id DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("query orders: %w", err)
	}
	defer rows.Close()
	return scanOrders(rows)
}

func (s *Store) ListAllOrders(ctx context.Context) ([]Order, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+orderSelectCols+`
		 FROM orders o LEFT JOIN users u ON u.id = o.user_id
		 ORDER BY o.id DESC LIMIT 500`)
	if err != nil {
		return nil, fmt.Errorf("query orders: %w", err)
	}
	defer rows.Close()
	return scanOrders(rows)
}

func (s *Store) FindOrderByRef(ctx context.Context, ref string) (Order, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+orderSelectCols+`
		 FROM orders o LEFT JOIN users u ON u.id = o.user_id
		 WHERE o.ref = ? LIMIT 1`, ref)
	if err != nil {
		return Order{}, fmt.Errorf("query order: %w", err)
	}
	defer rows.Close()
	list, err := scanOrders(rows)
	if err != nil {
		return Order{}, err
	}
	if len(list) == 0 {
		return Order{}, ErrNotFound
	}
	return list[0], nil
}

// ListSellerOrders returns orders that contain at least one product owned by the
// given seller, with items and subtotal scoped to that seller's items only.
func (s *Store) ListSellerOrders(ctx context.Context, sellerID int64) ([]SellerOrder, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM products WHERE seller_id = ?`, sellerID)
	if err != nil {
		return nil, fmt.Errorf("seller products: %w", err)
	}
	owned := make(map[int64]struct{})
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan product id: %w", err)
		}
		owned[id] = struct{}{}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(owned) == 0 {
		return []SellerOrder{}, nil
	}

	all, err := s.ListAllOrders(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]SellerOrder, 0)
	for _, o := range all {
		var items []OrderItem
		var subtotal float64
		for _, it := range o.Items {
			if _, ok := owned[it.ProductID]; !ok {
				continue
			}
			items = append(items, it)
			subtotal += it.Price * float64(it.Qty)
		}
		if len(items) == 0 {
			continue
		}
		out = append(out, SellerOrder{
			ID: o.ID, Ref: o.Ref, UserID: o.UserID, Username: o.Username,
			CustomerName: o.CustomerName, Phone: o.Phone, Address: o.Address,
			Items: items, Subtotal: subtotal,
			PaymentMethod: o.PaymentMethod, Status: o.Status, CreatedAt: o.CreatedAt,
		})
	}
	return out, nil
}

func (s *Store) SetOrderStatus(ctx context.Context, id int64, status string) error {
	if !validOrderStatus(status) {
		return fmt.Errorf("invalid status")
	}
	res, err := s.db.ExecContext(ctx, `UPDATE orders SET status = ? WHERE id = ?`, status, id)
	if err != nil {
		return fmt.Errorf("update order: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetOrderStatusByRef(ctx context.Context, ref, status string) error {
	if !validOrderStatus(status) {
		return fmt.Errorf("invalid status")
	}
	res, err := s.db.ExecContext(ctx, `UPDATE orders SET status = ? WHERE ref = ?`, status, ref)
	if err != nil {
		return fmt.Errorf("update order: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func validOrderStatus(status string) bool {
	switch status {
	case "pending", "shipped", "delivered", "cancelled":
		return true
	}
	return false
}
