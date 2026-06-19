package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrSessionNotFound    = errors.New("session not found")
	ErrNotFound           = errors.New("not found")
)

const (
	RoleAdmin  = "admin"
	RoleSeller = "seller"
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

type SessionInfo struct {
	Username   string
	AvatarPath string
	CreatedAt  time.Time
	ExpiresAt  time.Time
}

type Settings struct {
	SiteName    string
	Tagline     string
	LogoPath    string
	AccentColor string
	CodEnabled  bool
	CodFee      float64
	ShippingFee float64
}

type Category struct {
	ID       int64
	ParentID sql.NullInt64
	Name     string
	Slug     string
	Icon     string
	Position int
	Children []*Category
}

type Slide struct {
	ID        int64
	Title     string
	Body      string
	ImagePath string
	Position  int
	CreatedAt time.Time
}

type Brand struct {
	ID        int64
	Name      string
	Slug      string
	LogoPath  string
	Website   string
	Position  int
	CreatedAt time.Time
}

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

type SellerStats struct {
	TotalProducts  int
	TotalStock     int
	InventoryValue float64
	RecentProducts []Product
}

type Store struct {
	db        *sql.DB
	notifMu   sync.Mutex
	notifSubs []*notifSub
}

type notifSub struct {
	ch       chan Notification
	audience string
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

// SubscribeNotifications registers a buffered channel that receives every new
// notification whose audience matches (empty filter = all audiences). The
// returned cancel must be called to release resources.
func (s *Store) SubscribeNotifications(audience string, buf int) (<-chan Notification, func()) {
	if buf <= 0 {
		buf = 16
	}
	sub := &notifSub{ch: make(chan Notification, buf), audience: audience}
	s.notifMu.Lock()
	s.notifSubs = append(s.notifSubs, sub)
	s.notifMu.Unlock()
	return sub.ch, func() {
		s.notifMu.Lock()
		defer s.notifMu.Unlock()
		for i, x := range s.notifSubs {
			if x == sub {
				s.notifSubs = append(s.notifSubs[:i], s.notifSubs[i+1:]...)
				close(sub.ch)
				return
			}
		}
	}
}

func (s *Store) publishNotification(n Notification) {
	s.notifMu.Lock()
	defer s.notifMu.Unlock()
	for _, sub := range s.notifSubs {
		if sub.audience != "" && sub.audience != n.Audience {
			continue
		}
		// non-blocking: drop on slow consumer to keep the publisher fast.
		select {
		case sub.ch <- n:
		default:
		}
	}
}

func (s *Store) Migrate(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INT AUTO_INCREMENT PRIMARY KEY,
			username VARCHAR(64) NOT NULL UNIQUE,
			password_hash VARBINARY(60) NOT NULL,
			role VARCHAR(16) NOT NULL DEFAULT 'admin',
			display_name VARCHAR(120) NOT NULL DEFAULT '',
			email VARCHAR(160) NOT NULL DEFAULT '',
			avatar_path VARCHAR(255) NOT NULL DEFAULT '',
			cover_path VARCHAR(255) NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token CHAR(64) PRIMARY KEY,
			user_id INT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			expires_at DATETIME NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			INDEX idx_expires (expires_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS settings (
			k VARCHAR(64) PRIMARY KEY,
			v VARCHAR(500) NOT NULL DEFAULT ''
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS categories (
			id INT AUTO_INCREMENT PRIMARY KEY,
			parent_id INT NULL,
			name VARCHAR(120) NOT NULL,
			slug VARCHAR(160) NOT NULL,
			icon VARCHAR(32) NOT NULL DEFAULT '',
			position INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
			UNIQUE KEY uniq_cat_slug (slug),
			INDEX idx_cat_parent (parent_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS slides (
			id INT AUTO_INCREMENT PRIMARY KEY,
			title VARCHAR(160) NOT NULL,
			body VARCHAR(500) NOT NULL DEFAULT '',
			image_path VARCHAR(255) NOT NULL,
			position INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_slides_position (position)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS brands (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(120) NOT NULL,
			slug VARCHAR(160) NOT NULL,
			logo_path VARCHAR(255) NOT NULL DEFAULT '',
			website VARCHAR(255) NOT NULL DEFAULT '',
			position INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE KEY uniq_brand_slug (slug),
			INDEX idx_brand_position (position)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS flash_sales (
			id INT AUTO_INCREMENT PRIMARY KEY,
			product_id INT NULL,
			title VARCHAR(160) NOT NULL,
			image_path VARCHAR(255) NOT NULL,
			original_price DECIMAL(10,2) NOT NULL DEFAULT 0,
			sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
			stock INT NOT NULL DEFAULT 0,
			sold INT NOT NULL DEFAULT 0,
			ends_at DATETIME NOT NULL,
			position INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
			INDEX idx_flash_ends (ends_at),
			INDEX idx_flash_position (position),
			INDEX idx_flash_product (product_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS notifications (
			id INT AUTO_INCREMENT PRIMARY KEY,
			audience VARCHAR(32) NOT NULL,
			kind VARCHAR(64) NOT NULL,
			title VARCHAR(255) NOT NULL,
			body VARCHAR(500) NOT NULL DEFAULT '',
			link VARCHAR(255) NOT NULL DEFAULT '',
			related_id INT NULL,
			read_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_notif_audience_read (audience, read_at),
			INDEX idx_notif_audience_created (audience, created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS products (
			id INT AUTO_INCREMENT PRIMARY KEY,
			seller_id INT NOT NULL,
			sku VARCHAR(32) NOT NULL DEFAULT '',
			name VARCHAR(128) NOT NULL,
			description TEXT NOT NULL,
			image_path VARCHAR(255) NOT NULL DEFAULT '',
			price DECIMAL(10,2) NOT NULL DEFAULT 0,
			stock INT NOT NULL DEFAULT 0,
			shipping_days INT NOT NULL DEFAULT 0,
			category_id INT NULL,
			brand_id INT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'approved',
			review_note VARCHAR(500) NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
			FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
			UNIQUE KEY uniq_product_sku (sku),
			INDEX idx_seller (seller_id),
			INDEX idx_product_status (status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		`CREATE TABLE IF NOT EXISTS orders (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			ref VARCHAR(48) NOT NULL DEFAULT '',
			customer_name VARCHAR(160) NOT NULL,
			phone VARCHAR(40) NOT NULL,
			address VARCHAR(500) NOT NULL,
			items_json TEXT NOT NULL,
			subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
			shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
			cod_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
			total DECIMAL(12,2) NOT NULL DEFAULT 0,
			payment_method VARCHAR(16) NOT NULL DEFAULT 'cod',
			status VARCHAR(16) NOT NULL DEFAULT 'pending',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			INDEX idx_orders_user (user_id),
			INDEX idx_orders_status (status),
			INDEX idx_orders_ref (ref)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}
	for _, q := range stmts {
		if _, err := s.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	// Backfill role column for pre-existing installs that lacked it.
	_, _ = s.db.ExecContext(ctx,
		`ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'admin'`)
	_, _ = s.db.ExecContext(ctx,
		`ALTER TABLE users ADD COLUMN display_name VARCHAR(120) NOT NULL DEFAULT ''`)
	_, _ = s.db.ExecContext(ctx,
		`ALTER TABLE users ADD COLUMN email VARCHAR(160) NOT NULL DEFAULT ''`)
	_, _ = s.db.ExecContext(ctx,
		`ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255) NOT NULL DEFAULT ''`)
	_, _ = s.db.ExecContext(ctx,
		`ALTER TABLE users ADD COLUMN cover_path VARCHAR(255) NOT NULL DEFAULT ''`)
	// Backfill position column for installs created before reordering existed.
	_, _ = s.db.ExecContext(ctx,
		`ALTER TABLE slides ADD COLUMN position INT NOT NULL DEFAULT 0`)
	_, _ = s.db.ExecContext(ctx, `UPDATE slides SET position = id WHERE position = 0`)

	// Backfill product columns added in the seller-approval feature.
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN sku VARCHAR(32) NOT NULL DEFAULT ''`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN description TEXT NOT NULL`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN image_path VARCHAR(255) NOT NULL DEFAULT ''`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN shipping_days INT NOT NULL DEFAULT 0`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN category_id INT NULL`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN brand_id INT NULL`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'approved'`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE products ADD COLUMN review_note VARCHAR(500) NOT NULL DEFAULT ''`)
	// Flash sales: link to a product when admin selects one.
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE flash_sales ADD COLUMN product_id INT NULL`)

	// Existing rows with empty SKU get a generated one.
	if rows, err := s.db.QueryContext(ctx, `SELECT id FROM products WHERE sku = ''`); err == nil {
		var ids []int64
		for rows.Next() {
			var id int64
			if rows.Scan(&id) == nil {
				ids = append(ids, id)
			}
		}
		rows.Close()
		for _, id := range ids {
			sku, _ := s.uniqueSKU(ctx)
			_, _ = s.db.ExecContext(ctx, `UPDATE products SET sku = ? WHERE id = ?`, sku, id)
		}
	}

	// Orders: backfill ref for legacy rows + ensure column exists on older installs.
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE orders ADD COLUMN ref VARCHAR(48) NOT NULL DEFAULT ''`)
	_, _ = s.db.ExecContext(ctx, `ALTER TABLE orders ADD INDEX idx_orders_ref (ref)`)
	if rows, err := s.db.QueryContext(ctx, `SELECT id FROM orders WHERE ref = ''`); err == nil {
		var ids []int64
		for rows.Next() {
			var id int64
			if rows.Scan(&id) == nil {
				ids = append(ids, id)
			}
		}
		rows.Close()
		if len(ids) > 0 {
			settings, _ := s.Settings(ctx)
			for _, id := range ids {
				ref, _ := s.uniqueOrderRef(ctx, settings.SiteName)
				_, _ = s.db.ExecContext(ctx, `UPDATE orders SET ref = ? WHERE id = ?`, ref, id)
			}
		}
	}

	return nil
}

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

const sessionTTL = 24 * time.Hour

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

type CreateProductInput struct {
	Name          string
	Description   string
	ImagePath     string
	Price         float64
	Stock         int
	ShippingDays  int
	CategoryID    *int64
	BrandID       *int64
	AutoApprove   bool
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

type Notification struct {
	ID        int64
	Audience  string
	Kind      string
	Title     string
	Body      string
	Link      string
	RelatedID sql.NullInt64
	ReadAt    sql.NullTime
	CreatedAt time.Time
}

func (s *Store) CreateNotification(ctx context.Context, n Notification) error {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO notifications (audience, kind, title, body, link, related_id)
		VALUES (?, ?, ?, ?, ?, ?)`,
		n.Audience, n.Kind, n.Title, n.Body, n.Link, n.RelatedID)
	if err != nil {
		return fmt.Errorf("notify insert: %w", err)
	}
	if id, err := res.LastInsertId(); err == nil {
		n.ID = id
		n.CreatedAt = time.Now()
		s.publishNotification(n)
	}
	return nil
}

// ListNotifications returns the most recent notifications for an audience
// plus the unread count. Limit caps how many rows are returned.
func (s *Store) ListNotifications(ctx context.Context, audience string, limit int) ([]Notification, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, audience, kind, title, body, link, related_id, read_at, created_at
		FROM notifications
		WHERE audience = ?
		ORDER BY created_at DESC
		LIMIT ?`, audience, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()
	out := make([]Notification, 0, limit)
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Audience, &n.Kind, &n.Title, &n.Body, &n.Link,
			&n.RelatedID, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, n)
	}
	var unread int
	if err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notifications WHERE audience = ? AND read_at IS NULL`,
		audience).Scan(&unread); err != nil {
		return nil, 0, err
	}
	return out, unread, nil
}

// MarkNotificationsRead marks all notifications for the audience as read; if
// ids is non-empty, only those IDs are marked. Returns rows affected.
func (s *Store) MarkNotificationsRead(ctx context.Context, audience string, ids []int64) (int64, error) {
	if len(ids) == 0 {
		res, err := s.db.ExecContext(ctx,
			`UPDATE notifications SET read_at = NOW() WHERE audience = ? AND read_at IS NULL`,
			audience)
		if err != nil {
			return 0, fmt.Errorf("mark all read: %w", err)
		}
		n, _ := res.RowsAffected()
		return n, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, 0, len(ids)+1)
	args = append(args, audience)
	for i, id := range ids {
		placeholders[i] = "?"
		args = append(args, id)
	}
	q := fmt.Sprintf(
		`UPDATE notifications SET read_at = NOW() WHERE audience = ? AND read_at IS NULL AND id IN (%s)`,
		strings.Join(placeholders, ","))
	res, err := s.db.ExecContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("mark ids read: %w", err)
	}
	n, _ := res.RowsAffected()
	return n, nil
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

func (s *Store) Settings(ctx context.Context) (Settings, error) {
	out := Settings{SiteName: "Simple Web App", CodEnabled: true}
	rows, err := s.db.QueryContext(ctx, `SELECT k, v FROM settings`)
	if err != nil {
		return out, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return out, fmt.Errorf("scan: %w", err)
		}
		switch k {
		case "site_name":
			if v != "" {
				out.SiteName = v
			}
		case "tagline":
			out.Tagline = v
		case "logo_path":
			out.LogoPath = v
		case "accent_color":
			out.AccentColor = v
		case "cod_enabled":
			out.CodEnabled = v != "0" && v != "false"
		case "cod_fee":
			f, _ := strconv.ParseFloat(v, 64)
			out.CodFee = f
		case "shipping_fee":
			f, _ := strconv.ParseFloat(v, 64)
			out.ShippingFee = f
		}
	}
	return out, rows.Err()
}

func (s *Store) SetSetting(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)`,
		key, value)
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

func (s *Store) ListSlides(ctx context.Context) ([]Slide, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, title, body, image_path, position, created_at FROM slides ORDER BY position, id`)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var slides []Slide
	for rows.Next() {
		var sl Slide
		if err := rows.Scan(&sl.ID, &sl.Title, &sl.Body, &sl.ImagePath, &sl.Position, &sl.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		slides = append(slides, sl)
	}
	return slides, rows.Err()
}

func (s *Store) CreateSlide(ctx context.Context, title, body, imagePath string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO slides (title, body, image_path, position)
		 VALUES (?, ?, ?, COALESCE((SELECT next_pos FROM (SELECT MAX(position) + 1 AS next_pos FROM slides) t), 1))`,
		title, body, imagePath)
	return err
}

func (s *Store) ReorderSlides(ctx context.Context, orderedIDs []int64) error {
	if len(orderedIDs) == 0 {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()
	stmt, err := tx.PrepareContext(ctx, `UPDATE slides SET position = ? WHERE id = ?`)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()
	for i, id := range orderedIDs {
		if _, err := stmt.ExecContext(ctx, i+1, id); err != nil {
			return fmt.Errorf("update %d: %w", id, err)
		}
	}
	return tx.Commit()
}

func (s *Store) DeleteSlide(ctx context.Context, id int64) (string, error) {
	var imagePath string
	err := s.db.QueryRowContext(ctx, `SELECT image_path FROM slides WHERE id = ?`, id).Scan(&imagePath)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("lookup: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM slides WHERE id = ?`, id); err != nil {
		return "", fmt.Errorf("delete: %w", err)
	}
	return imagePath, nil
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

const orderSelectCols = `o.id, o.ref, o.user_id, COALESCE(u.username,''), o.customer_name, o.phone, o.address,
		o.items_json, o.subtotal, o.shipping_fee, o.cod_fee, o.total,
		o.payment_method, o.status, o.created_at`

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

func (s *Store) SetOrderStatus(ctx context.Context, id int64, status string) error {
	switch status {
	case "pending", "shipped", "delivered", "cancelled":
	default:
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
	switch status {
	case "pending", "shipped", "delivered", "cancelled":
	default:
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
