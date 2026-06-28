package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"smple-web-app/internal/middleware"
	"smple-web-app/internal/store"
)

type orderItemDTO struct {
	ProductID int64   `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Qty       int     `json:"qty"`
	ImagePath string  `json:"imagePath"`
}

type orderDTO struct {
	ID            int64          `json:"id"`
	Ref           string         `json:"ref"`
	UserID        int64          `json:"userId"`
	Username      string         `json:"username"`
	CustomerName  string         `json:"customerName"`
	Phone         string         `json:"phone"`
	Address       string         `json:"address"`
	Items         []orderItemDTO `json:"items"`
	Subtotal      float64        `json:"subtotal"`
	ShippingFee   float64        `json:"shippingFee"`
	CodFee        float64        `json:"codFee"`
	Total         float64        `json:"total"`
	PaymentMethod string         `json:"paymentMethod"`
	Status        string         `json:"status"`
	CreatedAt     time.Time      `json:"createdAt"`
}

func toOrderDTO(o store.Order) orderDTO {
	items := make([]orderItemDTO, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, orderItemDTO{
			ProductID: it.ProductID, Name: it.Name, Price: it.Price,
			Qty: it.Qty, ImagePath: it.ImagePath,
		})
	}
	return orderDTO{
		ID: o.ID, Ref: o.Ref, UserID: o.UserID, Username: o.Username,
		CustomerName: o.CustomerName, Phone: o.Phone, Address: o.Address,
		Items:    items,
		Subtotal: o.Subtotal, ShippingFee: o.ShippingFee, CodFee: o.CodFee, Total: o.Total,
		PaymentMethod: o.PaymentMethod, Status: o.Status, CreatedAt: o.CreatedAt,
	}
}

func (a *API) userOrders(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodGet) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	orders, err := a.Store.ListUserOrders(r.Context(), u.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]orderDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, toOrderDTO(o))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) orderCreate(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	var body struct {
		CustomerName  string `json:"customerName"`
		Phone         string `json:"phone"`
		Address       string `json:"address"`
		PaymentMethod string `json:"paymentMethod"`
		Items         []struct {
			ProductID int64 `json:"productId"`
			Qty       int   `json:"qty"`
		} `json:"items"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	body.CustomerName = strings.TrimSpace(body.CustomerName)
	body.Phone = strings.TrimSpace(body.Phone)
	body.Address = strings.TrimSpace(body.Address)
	body.PaymentMethod = strings.TrimSpace(body.PaymentMethod)
	if body.CustomerName == "" || body.Phone == "" || body.Address == "" {
		writeErr(w, http.StatusBadRequest, "name, phone, and address required")
		return
	}
	if body.PaymentMethod == "" {
		body.PaymentMethod = "cod"
	}
	if len(body.Items) == 0 {
		writeErr(w, http.StatusBadRequest, "cart is empty")
		return
	}

	settings, err := a.Store.Settings(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if body.PaymentMethod == "cod" && !settings.CodEnabled {
		writeErr(w, http.StatusBadRequest, "cash on delivery is disabled")
		return
	}

	// Resolve products fresh from DB; never trust client prices/stock.
	allApproved, err := a.Store.ListProductsByStatus(r.Context(), store.ProductApproved)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	byID := make(map[int64]store.Product, len(allApproved))
	for _, p := range allApproved {
		byID[p.ID] = p
	}
	resolved := make([]store.OrderItem, 0, len(body.Items))
	var subtotal float64
	for _, it := range body.Items {
		p, ok := byID[it.ProductID]
		if !ok {
			writeErr(w, http.StatusBadRequest, fmt.Sprintf("product %d unavailable", it.ProductID))
			return
		}
		if it.Qty <= 0 || it.Qty > p.Stock {
			writeErr(w, http.StatusBadRequest, fmt.Sprintf("invalid quantity for %s", p.Name))
			return
		}
		resolved = append(resolved, store.OrderItem{
			ProductID: p.ID, Name: p.Name, Price: p.Price, Qty: it.Qty, ImagePath: p.ImagePath,
		})
		subtotal += p.Price * float64(it.Qty)
	}
	codFee := 0.0
	if body.PaymentMethod == "cod" {
		codFee = settings.CodFee
	}
	total := subtotal + settings.ShippingFee + codFee

	id, ref, err := a.Store.CreateOrder(r.Context(), store.CreateOrderInput{
		UserID:        u.ID,
		CustomerName:  body.CustomerName,
		Phone:         body.Phone,
		Address:       body.Address,
		Items:         resolved,
		Subtotal:      subtotal,
		ShippingFee:   settings.ShippingFee,
		CodFee:        codFee,
		Total:         total,
		PaymentMethod: body.PaymentMethod,
	})
	if err != nil {
		log.Printf("create order: %v", err)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	a.notifySellersOfOrder(r.Context(), id, ref, body.CustomerName, resolved, byID)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true, "id": id, "ref": ref, "subtotal": subtotal,
		"shippingFee": settings.ShippingFee, "codFee": codFee, "total": total,
	})
}

// notifySellersOfOrder sends one notification per seller whose product was
// included in the order, scoped to that seller's items and revenue. Failures
// are logged but do not fail the order request.
func (a *API) notifySellersOfOrder(
	ctx context.Context, orderID int64, ref, customer string,
	items []store.OrderItem, byID map[int64]store.Product,
) {
	type agg struct {
		units    int
		revenue  float64
		products map[string]struct{}
	}
	bySeller := make(map[int64]*agg)
	for _, it := range items {
		p, ok := byID[it.ProductID]
		if !ok {
			continue
		}
		a := bySeller[p.SellerID]
		if a == nil {
			a = &agg{products: make(map[string]struct{})}
			bySeller[p.SellerID] = a
		}
		a.units += it.Qty
		a.revenue += it.Price * float64(it.Qty)
		a.products[it.Name] = struct{}{}
	}
	for sellerID, ag := range bySeller {
		body := fmt.Sprintf("%s placed order %s — %d unit%s of your products ($%.2f).",
			customer, ref, ag.units, plural(ag.units), ag.revenue)
		err := a.Store.CreateNotification(ctx, store.Notification{
			Audience:  fmt.Sprintf("seller:%d", sellerID),
			Kind:      "order_placed",
			Title:     "New order placed",
			Body:      body,
			Link:      "/seller/orders",
			RelatedID: sql.NullInt64{Int64: orderID, Valid: orderID > 0},
		})
		if err != nil {
			log.Printf("notify seller %d: %v", sellerID, err)
		}
	}
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

type sellerOrderDTO struct {
	ID            int64          `json:"id"`
	Ref           string         `json:"ref"`
	Username      string         `json:"username"`
	CustomerName  string         `json:"customerName"`
	Phone         string         `json:"phone"`
	Address       string         `json:"address"`
	Items         []orderItemDTO `json:"items"`
	Subtotal      float64        `json:"subtotal"`
	PaymentMethod string         `json:"paymentMethod"`
	Status        string         `json:"status"`
	CreatedAt     time.Time      `json:"createdAt"`
}

func toSellerOrderDTO(o store.SellerOrder) sellerOrderDTO {
	items := make([]orderItemDTO, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, orderItemDTO{
			ProductID: it.ProductID, Name: it.Name, Price: it.Price,
			Qty: it.Qty, ImagePath: it.ImagePath,
		})
	}
	return sellerOrderDTO{
		ID: o.ID, Ref: o.Ref, Username: o.Username,
		CustomerName: o.CustomerName, Phone: o.Phone, Address: o.Address,
		Items: items, Subtotal: o.Subtotal,
		PaymentMethod: o.PaymentMethod, Status: o.Status, CreatedAt: o.CreatedAt,
	}
}

func (a *API) sellerOrders(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodGet) {
		return
	}
	u, _ := middleware.UserFrom(r.Context())
	orders, err := a.Store.ListSellerOrders(r.Context(), u.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]sellerOrderDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, toSellerOrderDTO(o))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminOrders(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodGet) {
		return
	}
	orders, err := a.Store.ListAllOrders(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]orderDTO, 0, len(orders))
	for _, o := range orders {
		out = append(out, toOrderDTO(o))
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) adminOrderByRef(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimSpace(r.PathValue("ref"))
	if ref == "" {
		writeErr(w, http.StatusBadRequest, "ref required")
		return
	}
	o, err := a.Store.FindOrderByRef(r.Context(), ref)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, toOrderDTO(o))
}

func (a *API) adminOrderStatus(w http.ResponseWriter, r *http.Request) {
	if !methodAllowed(w, r, http.MethodPost) {
		return
	}
	var body struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	if err := a.Store.SetOrderStatus(r.Context(), body.ID, strings.TrimSpace(body.Status)); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
