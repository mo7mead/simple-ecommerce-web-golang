package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
)

type productDTO struct {
	ID             int64     `json:"id"`
	SellerID       int64     `json:"sellerId"`
	SellerUsername string    `json:"sellerUsername"`
	SKU            string    `json:"sku"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	ImagePath      string    `json:"imagePath"`
	Price          float64   `json:"price"`
	Stock          int       `json:"stock"`
	ShippingDays   int       `json:"shippingDays"`
	CategoryID     *int64    `json:"categoryId"`
	CategoryName   string    `json:"categoryName"`
	BrandID        *int64    `json:"brandId"`
	BrandName      string    `json:"brandName"`
	Status         string    `json:"status"`
	ReviewNote     string    `json:"reviewNote"`
	CreatedAt      time.Time `json:"createdAt"`
}

func toProductDTO(p store.Product) productDTO {
	out := productDTO{
		ID: p.ID, SellerID: p.SellerID, SellerUsername: p.SellerUsername,
		SKU: p.SKU, Name: p.Name, Description: p.Description, ImagePath: p.ImagePath,
		Price: p.Price, Stock: p.Stock, ShippingDays: p.ShippingDays,
		CategoryName: p.CategoryName, BrandName: p.BrandName,
		Status: p.Status, ReviewNote: p.ReviewNote, CreatedAt: p.CreatedAt,
	}
	if p.CategoryID.Valid {
		v := p.CategoryID.Int64
		out.CategoryID = &v
	}
	if p.BrandID.Valid {
		v := p.BrandID.Int64
		out.BrandID = &v
	}
	return out
}

func parseOptionalInt64(s string) (*int64, error) {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return nil, nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (a *API) publicProducts(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodGet) {
		return
	}
	products, err := a.Store.ListProductsByStatus(r.Context(), store.ProductApproved)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]productDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toProductDTO(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) sellerProducts(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodGet) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	products, err := a.Store.ListProducts(r.Context(), u.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]productDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toProductDTO(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) sellerProductCreate(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeErr(w, http.StatusBadRequest, "upload too large")
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	price, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("price")), 64)
	if err != nil || price < 0 {
		writeErr(w, http.StatusBadRequest, "price invalid")
		return
	}
	stock, err := strconv.Atoi(strings.TrimSpace(r.FormValue("stock")))
	if err != nil || stock < 0 {
		writeErr(w, http.StatusBadRequest, "stock invalid")
		return
	}
	shippingDays, err := strconv.Atoi(strings.TrimSpace(r.FormValue("shippingDays")))
	if err != nil || shippingDays < 0 {
		shippingDays = 0
	}
	categoryID, err := parseOptionalInt64(r.FormValue("categoryId"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "category invalid")
		return
	}
	brandID, err := parseOptionalInt64(r.FormValue("brandId"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "brand invalid")
		return
	}
	description := strings.TrimSpace(r.FormValue("description"))

	var imagePath string
	if file, header, err := r.FormFile("image"); err == nil && header.Size > 0 {
		defer file.Close()
		imagePath, err = a.saveImage(file, header.Filename, "products")
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	in := store.CreateProductInput{
		Name: name, Description: description, ImagePath: imagePath,
		Price: price, Stock: stock, ShippingDays: shippingDays,
		CategoryID: categoryID, BrandID: brandID,
	}
	sku, err := a.Store.CreateProduct(r.Context(), u.ID, in)
	if err != nil {
		if imagePath != "" {
			a.deleteUpload(imagePath)
		}
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "sku": sku, "status": store.ProductPending})
}

func (a *API) sellerProductDelete(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		ID int64 `json:"id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.DeleteProduct(r.Context(), u.ID, body.ID); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminProducts(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "all" {
		status = ""
	}
	products, err := a.Store.ListProductsByStatus(r.Context(), status)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]productDTO, 0, len(products))
	for _, p := range products {
		out = append(out, toProductDTO(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminProductApprove(w http.ResponseWriter, r *http.Request) {
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
	if err := a.Store.ApproveProduct(r.Context(), body.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not pending")
			return
		}
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminProductReject(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		ID   int64  `json:"id"`
		Note string `json:"note"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.RejectProduct(r.Context(), body.ID, strings.TrimSpace(body.Note)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not pending")
			return
		}
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminProductSetStatus(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.SetProductStatus(r.Context(), body.ID, strings.TrimSpace(body.Status), strings.TrimSpace(body.Note)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) adminProductBulkStatus(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		IDs    []int64 `json:"ids"`
		Status string  `json:"status"`
		Note   string  `json:"note"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if len(body.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, "no ids")
		return
	}
	if len(body.IDs) > 500 {
		writeErr(w, http.StatusBadRequest, "too many ids")
		return
	}
	changed, err := a.Store.BulkSetProductStatus(r.Context(), body.IDs, strings.TrimSpace(body.Status), strings.TrimSpace(body.Note))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "changed": changed})
}
