package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"smple-web-app/internal/config"
	"smple-web-app/internal/handler"
	"smple-web-app/internal/store"
	"smple-web-app/internal/view"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := sql.Open("mysql", cfg.DSN())
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping db: %v", err)
	}
	log.Printf("Connected to MySQL at %s:%s/%s", cfg.DBHost, cfg.DBPort, cfg.DBName)

	st := store.New(db)
	if err := st.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := st.EnsureUser(ctx, "admin", "admin", store.RoleAdmin); err != nil {
		log.Fatalf("seed admin: %v", err)
	}
	if err := st.EnsureUser(ctx, "seller", "seller", store.RoleSeller); err != nil {
		log.Fatalf("seed seller: %v", err)
	}

	go purgeLoop(st)

	views, err := view.Load()
	if err != nil {
		log.Fatalf("load views: %v", err)
	}

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatalf("create upload dir: %v", err)
	}

	mux := http.NewServeMux()
	handler.Register(mux, views, st, cfg.UploadDir)

	srv := &http.Server{
		Addr:              cfg.AppAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("Server listening on http://localhost%s", cfg.AppAddr)
	log.Fatal(srv.ListenAndServe())
}

func purgeLoop(st *store.Store) {
	for range time.Tick(1 * time.Hour) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := st.PurgeExpiredSessions(ctx); err != nil {
			log.Printf("purge sessions: %v", err)
		}
		cancel()
	}
}
