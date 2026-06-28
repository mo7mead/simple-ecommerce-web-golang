package store

import (
	"context"
	"fmt"
	"strconv"
)

type Settings struct {
	SiteName    string
	Tagline     string
	LogoPath    string
	AccentColor string
	CodEnabled  bool
	CodFee      float64
	ShippingFee float64
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
