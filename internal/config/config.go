package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppAddr    string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	UploadDir  string
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		AppAddr:    getenv("APP_ADDR", ":8000"),
		DBHost:     getenv("DB_HOST", "127.0.0.1"),
		DBPort:     getenv("DB_PORT", "3306"),
		DBUser:     os.Getenv("DB_USER"),
		DBPassword: os.Getenv("DB_PASSWORD"),
		DBName:     os.Getenv("DB_NAME"),
		UploadDir:  getenv("UPLOAD_DIR", "./uploads"),
	}
	if cfg.DBUser == "" || cfg.DBName == "" {
		return cfg, fmt.Errorf("DB_USER and DB_NAME must be set")
	}
	return cfg, nil
}

func (c Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
