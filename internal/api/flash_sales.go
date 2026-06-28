package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"smple-web-app/internal/store"
)

type flashSaleDTO struct {
	ID            int64     `json:"id"`
	ProductID     *int64    `json:"productId"`
	ProductName   string    `json:"productName"`
	ProductSKU    string    `json:"productSku"`
	Title         string    `json:"title"`
	ImagePath     string    `json:"imagePath"`
	OriginalPrice float64   `json:"originalPrice"`
	SalePrice     float64   `json:"salePrice"`
	Stock         int       `json:"stock"`
	Sold          int       `json:"sold"`
	EndsAt        time.Time `json:"endsAt"`
	Position      int       `json:"position"`
	CreatedAt     time.Time `json:"createdAt"`
}

func toFlashSaleDTO(f store.FlashSale) flashSaleDTO {
	dto := flashSaleDTO{
		ID: f.ID, ProductName: f.ProductName, ProductSKU: f.ProductSKU,
		Title: f.Title, ImagePath: f.ImagePath,
		OriginalPrice: f.OriginalPrice, SalePrice: f.SalePrice,
		Stock: f.Stock, Sold: f.Sold,
		EndsAt: f.EndsAt, Position: f.Position, CreatedAt: f.CreatedAt,
	}
	if f.ProductID.Valid {
		v := f.ProductID.Int64
		dto.ProductID = &v
	}
	return dto
}

func (a *API) flashSales(w http.ResponseWriter, r *http.Request) {
	items, err := a.Store.ListFlashSales(r.Context(), true)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]flashSaleDTO, 0, len(items))
	for _, f := range items {
		out = append(out, toFlashSaleDTO(f))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminFlashSales(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		items, err := a.Store.ListFlashSales(r.Context(), false)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		out := make([]flashSaleDTO, 0, len(items))
		for _, f := range items {
			out = append(out, toFlashSaleDTO(f))
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large")
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	productID, err := parseOptionalInt64(r.FormValue("productId"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "product invalid")
		return
	}
	if title == "" && productID == nil {
		writeErr(w, http.StatusBadRequest, "title or product required")
		return
	}
	originalPrice, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("originalPrice")), 64)
	if err != nil || originalPrice < 0 {
		writeErr(w, http.StatusBadRequest, "original price invalid")
		return
	}
	salePrice, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("salePrice")), 64)
	if err != nil || salePrice < 0 {
		writeErr(w, http.StatusBadRequest, "sale price invalid")
		return
	}
	if salePrice > originalPrice {
		writeErr(w, http.StatusBadRequest, "sale price must be ≤ original price")
		return
	}
	stock, err := strconv.Atoi(strings.TrimSpace(r.FormValue("stock")))
	if err != nil || stock < 0 {
		writeErr(w, http.StatusBadRequest, "stock invalid")
		return
	}
	endsAtStr := strings.TrimSpace(r.FormValue("endsAt"))
	if endsAtStr == "" {
		writeErr(w, http.StatusBadRequest, "end time required")
		return
	}
	endsAt, err := time.Parse(time.RFC3339, endsAtStr)
	if err != nil {
		// Allow datetime-local input (no timezone) — treat as local time.
		endsAt, err = time.ParseInLocation("2006-01-02T15:04", endsAtStr, time.Local)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "end time invalid")
			return
		}
	}
	if endsAt.Before(time.Now()) {
		writeErr(w, http.StatusBadRequest, "end time must be in the future")
		return
	}
	// Pull product details if linked, to allow the admin to inherit name/image.
	var productName, productImagePath string
	if productID != nil {
		products, perr := a.Store.ListProductsByStatus(r.Context(), store.ProductApproved)
		if perr == nil {
			for _, p := range products {
				if p.ID == *productID {
					productName = p.Name
					productImagePath = p.ImagePath
					break
				}
			}
			if productName == "" {
				writeErr(w, http.StatusBadRequest, "product not approved or not found")
				return
			}
		}
	}

	var webPath string
	if file, header, err := r.FormFile("image"); err == nil && header.Size > 0 {
		defer file.Close()
		webPath, err = a.saveImage(file, header.Filename, "flash-sales")
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
	} else if productImagePath != "" {
		webPath = productImagePath
	} else {
		writeErr(w, http.StatusBadRequest, "image required")
		return
	}

	if title == "" {
		title = productName
	}

	if err := a.Store.CreateFlashSale(r.Context(), productID, title, webPath, originalPrice, salePrice, stock, endsAt); err != nil {
		// Only delete uploads we created ourselves, never an inherited product image.
		if webPath != productImagePath {
			a.deleteUpload(webPath)
		}
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminFlashSaleDelete(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	path, err := a.Store.DeleteFlashSale(r.Context(), body.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if strings.HasPrefix(path, "/uploads/flash-sales/") {
		a.deleteUpload(path)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
