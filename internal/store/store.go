package store

import (
	"database/sql"
	"errors"
	"sync"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrSessionNotFound    = errors.New("session not found")
	ErrNotFound           = errors.New("not found")
	ErrUsernameTaken      = errors.New("username taken")
)

const (
	RoleAdmin  = "admin"
	RoleSeller = "seller"
	RoleBuyer  = "buyer"
)

type Store struct {
	db        *sql.DB
	notifMu   sync.Mutex
	notifSubs []*notifSub
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}
