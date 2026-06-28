package store

import (
	"context"
	"fmt"
)

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
		`CREATE TABLE IF NOT EXISTS addresses (
			id INT AUTO_INCREMENT PRIMARY KEY,
			user_id INT NOT NULL,
			label VARCHAR(64) NOT NULL DEFAULT '',
			recipient VARCHAR(160) NOT NULL,
			phone VARCHAR(40) NOT NULL,
			line VARCHAR(500) NOT NULL,
			is_default TINYINT(1) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			INDEX idx_addr_user (user_id),
			INDEX idx_addr_default (user_id, is_default)
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

	// Backfill columns added in later versions; errors are expected when the
	// column already exists, so they're intentionally ignored.
	for _, q := range []string{
		`ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'admin'`,
		`ALTER TABLE users ADD COLUMN display_name VARCHAR(120) NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN email VARCHAR(160) NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255) NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN cover_path VARCHAR(255) NOT NULL DEFAULT ''`,
		`ALTER TABLE slides ADD COLUMN position INT NOT NULL DEFAULT 0`,
		`UPDATE slides SET position = id WHERE position = 0`,
		`ALTER TABLE products ADD COLUMN sku VARCHAR(32) NOT NULL DEFAULT ''`,
		`ALTER TABLE products ADD COLUMN description TEXT NOT NULL`,
		`ALTER TABLE products ADD COLUMN image_path VARCHAR(255) NOT NULL DEFAULT ''`,
		`ALTER TABLE products ADD COLUMN shipping_days INT NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN category_id INT NULL`,
		`ALTER TABLE products ADD COLUMN brand_id INT NULL`,
		`ALTER TABLE products ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'approved'`,
		`ALTER TABLE products ADD COLUMN review_note VARCHAR(500) NOT NULL DEFAULT ''`,
		`ALTER TABLE flash_sales ADD COLUMN product_id INT NULL`,
		`ALTER TABLE orders ADD COLUMN ref VARCHAR(48) NOT NULL DEFAULT ''`,
		`ALTER TABLE orders ADD INDEX idx_orders_ref (ref)`,
	} {
		_, _ = s.db.ExecContext(ctx, q)
	}

	if err := s.backfillEmptySKUs(ctx); err != nil {
		return err
	}
	return s.backfillEmptyOrderRefs(ctx)
}

func (s *Store) backfillEmptySKUs(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM products WHERE sku = ''`)
	if err != nil {
		return nil
	}
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
	return nil
}

func (s *Store) backfillEmptyOrderRefs(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM orders WHERE ref = ''`)
	if err != nil {
		return nil
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	if len(ids) == 0 {
		return nil
	}
	settings, _ := s.Settings(ctx)
	for _, id := range ids {
		ref, _ := s.uniqueOrderRef(ctx, settings.SiteName)
		_, _ = s.db.ExecContext(ctx, `UPDATE orders SET ref = ? WHERE id = ?`, ref, id)
	}
	return nil
}
