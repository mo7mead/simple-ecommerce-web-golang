package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type Slide struct {
	ID        int64
	Title     string
	Body      string
	ImagePath string
	Position  int
	CreatedAt time.Time
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
