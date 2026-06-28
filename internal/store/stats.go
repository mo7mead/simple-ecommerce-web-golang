package store

import (
	"context"
	"fmt"
	"time"
)

type Stats struct {
	TotalUsers      int
	TotalAdmins     int
	TotalSellers    int
	ActiveSessions  int
	TotalCategories int
	TotalSlides     int
	TotalProducts   int
	InventoryValue  float64
	NewUsers7d      int
	NewProducts7d   int
	RecentSessions  []SessionInfo
	RecentProducts  []Product
	RecentUsers     []User
	YourSessionAge  time.Duration
}

type SellerStats struct {
	TotalProducts  int
	TotalStock     int
	InventoryValue float64
	RecentProducts []Product
}

func (s *Store) Stats(ctx context.Context, currentSessionAge time.Duration) (Stats, error) {
	var st Stats
	st.YourSessionAge = currentSessionAge

	if err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			SUM(role = 'admin'),
			SUM(role = 'seller'),
			SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
		FROM users`,
	).Scan(&st.TotalUsers, &st.TotalAdmins, &st.TotalSellers, &st.NewUsers7d); err != nil {
		return st, fmt.Errorf("user counts: %w", err)
	}
	if err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()`,
	).Scan(&st.ActiveSessions); err != nil {
		return st, fmt.Errorf("sessions count: %w", err)
	}
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM categories`).Scan(&st.TotalCategories); err != nil {
		return st, fmt.Errorf("categories count: %w", err)
	}
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM slides`).Scan(&st.TotalSlides); err != nil {
		return st, fmt.Errorf("slides count: %w", err)
	}
	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(price * stock), 0),
			SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))
		FROM products`,
	).Scan(&st.TotalProducts, &st.InventoryValue, &st.NewProducts7d); err != nil {
		return st, fmt.Errorf("products count: %w", err)
	}

	if rows, err := s.db.QueryContext(ctx, `
		SELECT u.username, u.avatar_path, s.created_at, s.expires_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		ORDER BY s.created_at DESC LIMIT 5`); err == nil {
		for rows.Next() {
			var si SessionInfo
			if err := rows.Scan(&si.Username, &si.AvatarPath, &si.CreatedAt, &si.ExpiresAt); err != nil {
				rows.Close()
				return st, fmt.Errorf("scan session: %w", err)
			}
			st.RecentSessions = append(st.RecentSessions, si)
		}
		rows.Close()
	} else {
		return st, fmt.Errorf("recent sessions: %w", err)
	}

	if rows, err := s.db.QueryContext(ctx, `
		SELECT id, seller_id, name, price, stock, created_at
		FROM products ORDER BY created_at DESC, id DESC LIMIT 5`); err == nil {
		for rows.Next() {
			var p Product
			if err := rows.Scan(&p.ID, &p.SellerID, &p.Name, &p.Price, &p.Stock, &p.CreatedAt); err != nil {
				rows.Close()
				return st, fmt.Errorf("scan product: %w", err)
			}
			st.RecentProducts = append(st.RecentProducts, p)
		}
		rows.Close()
	}

	if rows, err := s.db.QueryContext(ctx, `
		SELECT id, username, role, display_name, email, avatar_path, created_at FROM users
		ORDER BY created_at DESC, id DESC LIMIT 5`); err == nil {
		for rows.Next() {
			var u User
			if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.DisplayName, &u.Email, &u.AvatarPath, &u.CreatedAt); err != nil {
				rows.Close()
				return st, fmt.Errorf("scan user: %w", err)
			}
			st.RecentUsers = append(st.RecentUsers, u)
		}
		rows.Close()
	}
	return st, nil
}

func (s *Store) SellerStats(ctx context.Context, sellerID int64) (SellerStats, error) {
	var st SellerStats
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(stock), 0), COALESCE(SUM(price * stock), 0)
		FROM products WHERE seller_id = ?`, sellerID,
	).Scan(&st.TotalProducts, &st.TotalStock, &st.InventoryValue)
	if err != nil {
		return st, fmt.Errorf("seller stats: %w", err)
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, seller_id, name, price, stock, created_at
		FROM products WHERE seller_id = ? ORDER BY id DESC LIMIT 5`, sellerID)
	if err != nil {
		return st, fmt.Errorf("recent products: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.SellerID, &p.Name, &p.Price, &p.Stock, &p.CreatedAt); err != nil {
			return st, fmt.Errorf("scan: %w", err)
		}
		st.RecentProducts = append(st.RecentProducts, p)
	}
	return st, rows.Err()
}
