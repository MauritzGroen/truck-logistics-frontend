// src/api.ts
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  "https://truck-logistics-backend-production-174a.up.railway.app";

// Generic helper to call the backend API
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        ...options,
    });
  
  if (!response.ok) {
    let errorMessage = `API request failed: ${response.status}`;

    try {
      const text = await response.text();
      console.error("API error:", response.status, text);

      if (text) {
        // Try JSON first: { error: "..." }
        try {
          const data = JSON.parse(text);
          if (data && typeof data.error === "string") {
            errorMessage = data.error;
          }
        } catch {
          // Not JSON – just use the raw text
          errorMessage = text;
        }
      }
    } catch (e) {
      console.error("Error reading error body", e);
    }

    throw new Error(errorMessage);
  }
    // No content
    if (response.status === 204) {
        return undefined as unknown as T;
    }

    return (await response.json()) as T;
}

/* ---------- TYPES THAT MATCH THE BACKEND (snake_case) ---------- */

export interface ApiOrderRow {
    id: string;
    order_number: string;
    supplier_name: string;
    supplier_contact_person: string | null;
    supplier_contact_phone: string | null;
    supplier_email: string | null;
    sku: string;
    packaging_type: string;
    ordered_qty_tons: string;      // Supabase decimals come back as strings
    delivered_qty_tons: string;
    status: string;
    order_date: string;            // ISO date string
    created_at: string;
}

export interface ApiDeliveryRow {
    id: string;
    order_id: string;
    delivery_date: string;
    delivered_qty_tons: string;

    contractor_name: string;
    truck_number: string;
    trailer1_number: string | null;
    trailer2_number: string | null;

    driver_name: string;
    driver_id_number: string | null;
    driver_cell: string | null;

    loading_address: string | null;
    loading_number: string | null;
    loading_datetime: string | null;

    receipt_date: string | null;
    receipt_number: string | null;
    receipt_remarks: string | null;

    created_at: string;
}

/* ---------- PAYLOAD TYPES (what the frontend sends) ---------- */

export type CreateOrderPayload = {
    order_number: string;
    supplier_name: string;
    supplier_contact_person?: string;
    supplier_contact_phone?: string;
    supplier_email?: string;
    sku: string;
    packaging_type: string;
    ordered_qty_tons: number;
    delivered_qty_tons?: number;
    status: string;
    order_date: string; // "YYYY-MM-DD"
};

export type CreateDeliveryPayload = {
    delivery_date: string;
    delivered_qty_tons: number;

    contractor_name: string;
    truck_number: string;
    trailer1_number?: string;
    trailer2_number?: string;

    driver_name: string;
    driver_id_number?: string;
    driver_cell?: string;

    loading_address?: string;
    loading_number?: string;
    loading_datetime?: string; // ISO datetime string

    receipt_date?: string;
    receipt_number?: string;
    receipt_remarks?: string;
};

/* ---------- ORDERS API ---------- */

export async function getOrders(): Promise<ApiOrderRow[]> {
  return apiFetch<ApiOrderRow[]>("/orders");
}

export async function createOrder(
  payload: CreateOrderPayload
): Promise<ApiOrderRow> {
  return apiFetch<ApiOrderRow>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrder(
  orderId: string,
  payload: CreateOrderPayload
): Promise<ApiOrderRow> {
  return apiFetch<ApiOrderRow>(`/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteOrder(orderId: string): Promise<void> {
  await apiFetch<void>(`/orders/${orderId}`, {
    method: "DELETE",
  });
}

/* ---------- DELIVERIES API ---------- */

// Get all deliveries for a given order
export async function getDeliveries(orderId: string): Promise<ApiDeliveryRow[]> {
  return apiFetch<ApiDeliveryRow[]>(`/orders/${orderId}/deliveries`);
}

// Create a new delivery for an order
export async function createDelivery(
  orderId: string,
  payload: CreateDeliveryPayload
): Promise<ApiDeliveryRow> {
  return apiFetch<ApiDeliveryRow>(`/orders/${orderId}/deliveries`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Update an existing delivery for an order
export async function updateDelivery(
  orderId: string,
  deliveryId: string,
  payload: CreateDeliveryPayload
): Promise<ApiDeliveryRow> {
  return apiFetch<ApiDeliveryRow>(`/orders/${orderId}/deliveries/${deliveryId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 🔴 NEW: delete a single delivery for an order
export async function deleteDelivery(
  orderId: string,
  deliveryId: string
): Promise<void> {
  await apiFetch<void>(`/orders/${orderId}/deliveries/${deliveryId}`, {
    method: "DELETE",
  });
}

// ---------- TRANSPORTERS ----------

export type ApiTransporterRow = {
  id: string;
  name: string;
  contact_person: string | null;
  cell_no: string | null;
  email: string | null;
  has_tippers: boolean;
  has_flatbeds: boolean;
  has_tautliners: boolean;
  tipper_rate_dbn: string | null;
  tipper_rate_rb: string | null;
  flatbed_rate_dbn: string | null;
  flatbed_rate_rb: string | null;
  comments: string | null;
  created_at: string;
};

export type CreateTransporterPayload = {
  transporterName: string;
  contactPerson: string | null;
  cellNo: string | null;
  email: string | null;
  hasTippers: boolean;
  hasFlatbeds: boolean;
  hasTautliners: boolean;
  tipperRateDbn: string | null;
  tipperRateRb: string | null;
  flatbedRateDbn: string | null;
  flatbedRateRb: string | null;
  comments: string | null;
};

export type UpdateTransporterPayload = CreateTransporterPayload;

// GET all transporters
export async function getTransporters(): Promise<ApiTransporterRow[]> {
  return apiFetch<ApiTransporterRow[]>("/transporters");
}

// CREATE transporter
export async function createTransporter(
  payload: CreateTransporterPayload
): Promise<ApiTransporterRow> {
  return apiFetch<ApiTransporterRow>("/transporters", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// UPDATE transporter
export async function updateTransporter(
  id: string,
  payload: UpdateTransporterPayload
): Promise<ApiTransporterRow> {
  return apiFetch<ApiTransporterRow>(`/transporters/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// DELETE transporter
export async function deleteTransporter(id: string): Promise<void> {
  await apiFetch<void>(`/transporters/${id}`, {
    method: "DELETE",
  });
}

