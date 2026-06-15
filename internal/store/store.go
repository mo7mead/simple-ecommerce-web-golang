package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
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

type Product struct {
	ID        int64
	SellerID  int64
	Name      string
	Price     float64
	Stock     int
	CreatedAt time.Time
}

type SellerStats struct {
	TotalProducts  int
	TotalStock     int
	InventoryValue float64
	RecentProducts []Product
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
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
		`CREATE TABLE IF NOT EXISTS products (
			id INT AUTO_INCREMENT PRIMARY KEY,
			seller_id INT NOT NULL,
			name VARCHAR(128) NOT NULL,
			price DECIMAL(10,2) NOT NULL DEFAULT 0,
			stock INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
			INDEX idx_seller (seller_id)
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
	return nil
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

func (s *Store) ListProducts(ctx context.Context, sellerID int64) ([]Product, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, seller_id, name, price, stock, created_at FROM products WHERE seller_id = ? ORDER BY id DESC`,
		sellerID)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var products []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.SellerID, &p.Name, &p.Price, &p.Stock, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

func (s *Store) CreateProduct(ctx context.Context, sellerID int64, name string, price float64, stock int) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO products (seller_id, name, price, stock) VALUES (?, ?, ?, ?)`,
		sellerID, name, price, stock)
	return err
}

func (s *Store) DeleteProduct(ctx context.Context, sellerID, productID int64) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM products WHERE id = ? AND seller_id = ?`, productID, sellerID)
	return err
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
	out := Settings{SiteName: "Simple Web App"}
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
