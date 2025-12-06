import React, {
    FC,
    useEffect,
    useMemo,
    useState,
    CSSProperties,
    ChangeEvent,
    FormEvent,
} from "react";
import SmartDropdown from "./SmartDropdown";
import TransporterDetails from "./TransporterDetails";

import {
    CreateOrderPayload,
    CreateDeliveryPayload,
    getOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    getDeliveries,
    createDelivery,
    updateDelivery,
    deleteDelivery,
} from "./api";

// ---------- TYPES ----------

type OrderStatus = "Open" | "Partially Delivered" | "Closed" | "Cancelled";

interface Order {
    id: string;
    orderNumber: string;
    supplierName: string;
    supplierContactPerson: string;
    supplierContactPhone: string;
    supplierEmail: string;
    sku: string;
    packagingType: string;
    orderedQtyTons: number;
    deliveredQtyTons: number;
    status: OrderStatus;
    orderDate: string;
}

interface Delivery {
    id: string;
    orderId: string;
    deliveryDate: string;
    deliveredQtyTons: number;

    contractorName: string;
    truckNumber: string;
    trailer1Number: string;
    trailer2Number?: string;
    driverName: string;
    driverIdNumber: string;
    driverCell: string;

    loadingAddress: string;
    loadingNumber: string;
    loadingDatetime: string;

    receiptDate: string;
    receiptNumber: string;
    receiptRemarks: string;
}

function mapApiDeliveryRowToDelivery(row: ApiDeliveryRow): Delivery {
    return {
        id: row.id,
        orderId: row.order_id,
        deliveryDate: row.delivery_date,
        deliveredQtyTons: Number(row.delivered_qty_tons),

        contractorName: row.contractor_name ?? "",
        truckNumber: row.truck_number ?? "",
        trailer1Number: row.trailer1_number ?? "",
        trailer2Number: row.trailer2_number ?? "",
        driverName: row.driver_name ?? "",
        driverIdNumber: row.driver_id_number ?? "",
        driverCell: row.driver_cell ?? "",
        loadingAddress: row.loading_address ?? "",
        loadingNumber: row.loading_number ?? "",
        loadingDatetime: row.loading_datetime ?? "",
        receiptDate: row.receipt_date ?? "",
        receiptRemarks: row.receipt_remarks ?? "",
        receiptNumber: "",
    };
}

// ==== API → App mapping for Orders ====

type ApiOrderRow = {
    id: string;
    order_number: string;
    supplier_name: string;
    supplier_contact_person: string | null;
    supplier_contact_phone: string | null;
    supplier_email: string | null;
    sku: string | null;
    packaging_type: string | null;
    ordered_qty_tons: string;
    delivered_qty_tons: string;
    status: string;
    order_date: string;
};

const mapRowToOrder = (row: ApiOrderRow): Order => ({
    id: row.id,
    orderNumber: row.order_number,
    supplierName: row.supplier_name,
    supplierContactPerson: row.supplier_contact_person ?? "",
    supplierContactPhone: row.supplier_contact_phone ?? "",
    supplierEmail: row.supplier_email ?? "",
    sku: row.sku ?? "",
    packagingType: row.packaging_type ?? "",
    orderedQtyTons: Number(row.ordered_qty_tons || "0"),
    deliveredQtyTons: Number(row.delivered_qty_tons || "0"),
    status: row.status as OrderStatus,
    orderDate: row.order_date,
});

// ==== API <-> App mapping for Deliveries ====

type ApiDeliveryRow = {
    id: string;
    order_id: string;
    delivery_date: string;
    delivered_qty_tons: string;
    contractor_name: string | null;
    truck_number: string | null;
    trailer1_number: string | null;
    trailer2_number: string | null;
    driver_name: string | null;
    driver_id_number: string | null;
    driver_cell: string | null;
    loading_address: string | null;
    loading_number: string | null;
    loading_datetime: string | null;
    receipt_date: string | null;
    receipt_number: string | null;
    receipt_remarks: string | null;
};

const mapRowToDelivery = (row: ApiDeliveryRow): Delivery => ({
    id: row.id,
    orderId: row.order_id,
    deliveryDate: row.delivery_date,
    deliveredQtyTons: Number(row.delivered_qty_tons || "0"),
    contractorName: row.contractor_name ?? "",
    truckNumber: row.truck_number ?? "",
    trailer1Number: row.trailer1_number ?? "",
    trailer2Number: row.trailer2_number ?? "",
    driverName: row.driver_name ?? "",
    driverIdNumber: row.driver_id_number ?? "",
    driverCell: row.driver_cell ?? "",
    loadingAddress: row.loading_address ?? "",
    loadingNumber: row.loading_number ?? "",
    loadingDatetime: row.loading_datetime ?? "",
    receiptDate: row.receipt_date ?? "",
    receiptNumber: row.receipt_number ?? "",
    receiptRemarks: row.receipt_remarks ?? "",
});

interface OrderFormState {
    supplierName: string;
    supplierContactPerson: string;
    supplierContactPhone: string;
    supplierEmail: string;
    sku: string;
    packagingType: string;
    orderedQtyTons: string;
    orderNumber: string;
    orderDate: string;
}

interface DeliveryFormState {
    deliveryDate: string;
    deliveredQtyTons: string;

    contractorName: string;
    truckNumber: string;
    trailer1Number: string;
    trailer2Number: string;
    driverName: string;
    driverIdNumber: string;
    driverCell: string;

    loadingAddress: string;
    loadingNumber: string;
    loadingDatetime: string;

    receiptDate: string;
    receiptNumber: string;
    receiptRemarks: string;
}

// ---------- HELPERS ----------

const STORAGE_KEY_ORDERS = "truckLogistics.orders";
const STORAGE_KEY_DELIVERIES = "truckLogistics.deliveries";

const generateId = (): string => Math.random().toString(36).slice(2);

const todayDate = (): string => new Date().toISOString().slice(0, 10);

const nowDatetimeLocal = (): string => {
    const d = new Date();
    const iso = d.toISOString();
    return iso.slice(0, 16); // yyyy-mm-ddThh:mm
};

const isReceived = (delivery: Delivery): boolean =>
    !!delivery.receiptDate && delivery.receiptDate.trim().length > 0;

const recalcOrderStatus = (order: Order, deliveries: Delivery[]): Order => {
    // Only count deliveries that have a receipt date
    const orderDeliveries = deliveries.filter(
        (d) => d.orderId === order.id && isReceived(d)
    );
    const deliveredQty = orderDeliveries.reduce(
        (sum, d) => sum + d.deliveredQtyTons,
        0
    );
    const outstanding = order.orderedQtyTons - deliveredQty;

    let status: OrderStatus = "Open";
    if (deliveredQty === 0) status = "Open";
    else if (outstanding > 0) status = "Partially Delivered";
    else status = "Closed";

    return { ...order, deliveredQtyTons: deliveredQty, status };
};

// ---------- COMMON STYLES ----------

const labelStyle: CSSProperties = {
    fontWeight: 600,
    display: "block",
    marginBottom: 4,
};

const inputStyle: CSSProperties = {
    width: "100%",
    padding: "0.35rem 0.45rem",
    borderRadius: 4,
    border: "1px solid #aaa",
    boxSizing: "border-box",
};

const row4Style = (bg: string): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(170px, 1fr))",
    gap: "0.6rem",
    backgroundColor: bg,
    padding: "0.7rem 0.8rem",
    borderRadius: 4,
    marginBottom: "0.8rem",
});

const row3Style = (bg: string): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
    gap: "0.6rem",
    backgroundColor: bg,
    padding: "0.7rem 0.8rem",
    borderRadius: 4,
    marginBottom: "0.8rem",
});

const rowAutoStyle = (bg: string): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "0.6rem",
    backgroundColor: bg,
    padding: "0.7rem 0.8rem",
    borderRadius: 4,
    marginBottom: "0.8rem",
});

// ---------- PRINT / EXPORT HELPERS ----------

const basePrintStyles = `
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 16px;
    font-size: 12px;
  }
  h1, h2, h3 {
    margin: 0 0 8px 0;
    text-align: center;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 12px;
    font-size: 11px;
  }
  th, td {
    border: 1px solid #000;
    padding: 4px 6px;
  }
  th {
    background: #f2f2f2;
  }
  .section-title {
    font-weight: 700;
    margin-top: 16px;
    margin-bottom: 4px;
    text-align: left;
  }
  .header-table {
    width: 60%;
  }
`;

const openPrintWindow = (html: string, title: string) => {
    if (typeof window === "undefined") return;
    const win = window.open("", "_blank");
    if (!win) {
        alert("Popup blocked – please allow popups for printing.");
        return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>${basePrintStyles}</style>
</head>
<body onload="window.print()">
${html}
</body>
</html>`);
    win.document.close();
};

// ---------- MAIN COMPONENT ----------
interface AutocompleteWithHistoryProps {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    storageKey: string;
    required?: boolean;
    placeholder?: string;
}

const AutocompleteWithHistory: React.FC<AutocompleteWithHistoryProps> = ({
    label,
    name,
    value,
    onChange,
    storageKey,
    required,
    placeholder,
}) => {
    const [options, setOptions] = React.useState<string[]>([]);

    React.useEffect(() => {
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (raw) setOptions(JSON.parse(raw));
        } catch {
            // ignore
        }
    }, [storageKey]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(e);
        if (!newValue) return;

        setOptions((prev) => {
            if (prev.includes(newValue)) return prev;
            const next = [newValue, ...prev].slice(0, 20);
            try {
                window.localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });
    };

    const datalistId = `${name}-history`;

    return (
        <div>
            <label style={{ display: "block", fontSize: 12 }}>{label}</label>
            <input
                list={datalistId}
                name={name}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                required={required}
                style={inputStyle}
            />
            <datalist id={datalistId}>
                {options.map((opt) => (
                    <option key={opt} value={opt} />
                ))}
            </datalist>
        </div>
    );
};

const TruckLogisticsApp: FC = () => {
    const [orders, setOrders] = useState<Order[]>(() => {
        // original localStorage logic – keep it
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY_ORDERS);
            if (!stored) return [];
            const parsed = JSON.parse(stored) as Order[];
            return parsed;
        } catch (err) {
            return [];
        }
    });

    // Load orders from backend on first render
    useEffect(() => {
        async function loadOrdersFromApi() {
            try {
                const apiOrders = await getOrders();

                // Map Supabase rows (snake_case) ➜ frontend Order (camelCase)
                const mapped: Order[] = apiOrders.map((row: any): Order => ({
                    id: row.id,

                    orderNumber: row.order_number,
                    supplierName: row.supplier_name,

                    supplierContactPerson: row.supplier_contact_person ?? "",
                    supplierContactPhone: row.supplier_contact_phone ?? "",
                    supplierEmail: row.supplier_email ?? "",

                    sku: row.sku ?? "",
                    packagingType: row.packaging_type ?? "",
                    orderedQtyTons: Number(row.ordered_qty_tons ?? 0),
                    deliveredQtyTons: Number(row.delivered_qty_tons ?? 0),

                    // Supabase currently has status "na" – treat that as Open
                    status:
                        row.status === "na"
                            ? "Open"
                            : (row.status as OrderStatus) ?? "Open",

                    // order_date is ISO – keep yyyy-mm-dd
                    orderDate:
                        (row.order_date && row.order_date.slice(0, 10)) ||
                        todayDate(),
                }));

                setOrders(mapped);
            } catch (err) {
                console.error("Failed to load orders from API", err);
            }
        }

        loadOrdersFromApi();
    }, []);

    const [deliveries, setDeliveries] = useState<Delivery[]>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_DELIVERIES);
            if (!raw) return [];
            const parsed = JSON.parse(raw) as any[];
            return parsed.map((d) => ({
                loadingAddress: "",
                loadingNumber: "",
                loadingDatetime: "",
                receiptDate: "",
                receiptRemarks: "",
                ...d,
            })) as Delivery[];
        } catch (err) {
            return [];
        }
    });

    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [showClosedOrders, setShowClosedOrders] = useState<boolean>(true);
    const [showNewOrderForm, setShowNewOrderForm] = useState<boolean>(false);
    const [showDeliveryForm, setShowDeliveryForm] = useState<boolean>(false);

    const [orderForm, setOrderForm] = useState<OrderFormState>({
        supplierName: "",
        supplierContactPerson: "",
        supplierContactPhone: "",
        supplierEmail: "",
        sku: "",
        packagingType: "",
        orderedQtyTons: "",
        orderNumber: "",
        orderDate: todayDate(),
    });

    const resetOrderForm = () => {
        setOrderForm({
            supplierName: "",
            supplierContactPerson: "",
            supplierContactPhone: "",
            supplierEmail: "",
            sku: "",
            packagingType: "",
            orderedQtyTons: "",
            orderNumber: "",
            orderDate: todayDate(),
        });
    };
    const blankDeliveryForm: DeliveryFormState = {
        deliveryDate: todayDate(),
        deliveredQtyTons: "",
        contractorName: "",
        truckNumber: "",
        trailer1Number: "",
        trailer2Number: "",
        driverName: "",
        driverIdNumber: "",
        driverCell: "",
        loadingAddress: "",
        loadingNumber: "",
        loadingDatetime: nowDatetimeLocal(),
        receiptDate: "",
        receiptNumber: "",
        receiptRemarks: "",
    };

    const [deliveryForm, setDeliveryForm] =
        useState<DeliveryFormState>(blankDeliveryForm);

    const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(
        null
    );

    const [showTransporters, setShowTransporters] = useState<boolean>(false);

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    }, [orders]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_DELIVERIES, JSON.stringify(deliveries));
    }, [deliveries]);

    // Recalculate delivered qty / status whenever deliveries change
    useEffect(() => {
        setOrders((prev) => prev.map((o) => recalcOrderStatus(o, deliveries)));
    }, [deliveries]);

    // NEW: seed history for Driver ID, Driver Cell, Loading Address from all deliveries
    useEffect(() => {
        const driverIdSet = new Set<string>();
        const driverCellSet = new Set<string>();
        const loadingAddressSet = new Set<string>();

        deliveries.forEach((d) => {
            if (d.driverIdNumber && d.driverIdNumber.trim().length > 0) {
                driverIdSet.add(d.driverIdNumber.trim());
            }
            if (d.driverCell && d.driverCell.trim().length > 0) {
                driverCellSet.add(d.driverCell.trim());
            }
            if (d.loadingAddress && d.loadingAddress.trim().length > 0) {
                loadingAddressSet.add(d.loadingAddress.trim());
            }
        });

        const saveSet = (key: string, set: Set<string>) => {
            const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
            localStorage.setItem(key, JSON.stringify(arr));
        };

        saveSet("driverIdHistory", driverIdSet);
        saveSet("driverCellHistory", driverCellSet);
        saveSet("loadingAddressHistory", loadingAddressSet);
    }, [deliveries]);

    const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

    const deliveriesForSelectedOrder = useMemo(
        () =>
            selectedOrder
                ? deliveries
                    .filter((d) => d.orderId === selectedOrder.id)
                    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
                : [],
        [deliveries, selectedOrder]
    );

    // ---- ORDER FILTERS ----
    const [supplierFilter, setSupplierFilter] = useState<string>("all");
    const [skuFilter, setSkuFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Distinct values for dropdowns
    const supplierOptions = useMemo(
        () =>
            Array.from(new Set(orders.map((o) => o.supplierName)))
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b)),
        [orders]
    );

    const skuOptions = useMemo(
        () =>
            Array.from(new Set(orders.map((o) => o.sku)))
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b)),
        [orders]
    );

    const statusOptions = useMemo(
        () =>
            Array.from(new Set(orders.map((o) => o.status)))
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b)),
        [orders]
    );

    const visibleOrders = useMemo(
        () =>
            orders
                // existing "show closed" toggle
                .filter((o) => (showClosedOrders ? true : o.status !== "Closed"))
                // NEW: supplier filter
                .filter((o) =>
                    supplierFilter === "all" ? true : o.supplierName === supplierFilter
                )
                // NEW: SKU filter
                .filter((o) => (skuFilter === "all" ? true : o.sku === skuFilter))
                // NEW: status filter
                .filter((o) => (statusFilter === "all" ? true : o.status === statusFilter))
                // newest orders first
                .sort((a, b) => b.orderDate.localeCompare(a.orderDate)),
        [orders, showClosedOrders, supplierFilter, skuFilter, statusFilter]
    );

    // ---------- FORM HANDLERS ----------

    async function loadDeliveriesFromApi(orderId: string) {
        try {
            const apiRows = await getDeliveries(orderId);

            // Convert API rows (snake_case) → your Delivery type (camelCase)
            const mapped = apiRows.map((row: any) =>
                mapRowToDelivery(row)
            );

            // Replace deliveries for this order
            setDeliveries((prev) => {
                const others = prev.filter((d) => d.orderId !== orderId);
                return [...others, ...mapped];
            });

        } catch (err) {
            console.error("Failed to load deliveries:", err);
            alert("Could not load deliveries from server");
        }
    }

    const handleOrderFormChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setOrderForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleDeliveryFormChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setDeliveryForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreateOrder = async (e: FormEvent) => {
        e.preventDefault();

        const orderedQty = parseFloat(orderForm.orderedQtyTons || "0");

        if (!orderForm.orderNumber.trim() || !orderForm.supplierName.trim()) {
            alert("Order number and supplier name are required.");
            return;
        }

        try {
            // 1. SEND snake_case payload to backend (Supabase expects these names)
            const createdRow: any = await createOrder({
                order_number: orderForm.orderNumber.trim(),
                supplier_name: orderForm.supplierName.trim(),
                supplier_contact_person:
                    orderForm.supplierContactPerson.trim() || undefined,
                supplier_contact_phone:
                    orderForm.supplierContactPhone.trim() || undefined,
                supplier_email:
                    orderForm.supplierEmail.trim() || undefined,
                sku: orderForm.sku.trim(),
                packaging_type: orderForm.packagingType.trim(),
                ordered_qty_tons: orderedQty,
                delivered_qty_tons: 0,
                status: "Open", // or "na" if your backend prefers that
                order_date: orderForm.orderDate || todayDate(), // ISO date string
            });

            // 2. MAP returned Supabase row (snake_case) → your Order type (camelCase)
            const newOrder: Order = {
                id: createdRow.id,

                orderNumber: createdRow.order_number,
                supplierName: createdRow.supplier_name,

                supplierContactPerson: createdRow.supplier_contact_person ?? "",
                supplierContactPhone: createdRow.supplier_contact_phone ?? "",
                supplierEmail: createdRow.supplier_email ?? "",

                sku: createdRow.sku ?? "",
                packagingType: createdRow.packaging_type ?? "",
                orderedQtyTons: Number(createdRow.ordered_qty_tons ?? orderedQty),
                deliveredQtyTons: Number(createdRow.delivered_qty_tons ?? 0),

                status:
                    createdRow.status === "na"
                        ? "Open"
                        : (createdRow.status as OrderStatus) ?? "Open",

                // Supabase gives full ISO like "2025-11-27T22:00:00.000Z"
                // We only keep "yyyy-mm-dd" for display
                orderDate:
                    (createdRow.order_date && createdRow.order_date.slice(0, 10)) ||
                    (orderForm.orderDate || todayDate()),
            };

            // 3. UPDATE UI state
            setOrders((prev) => [newOrder, ...prev]);
            setSelectedOrderId(newOrder.id);
            resetOrderForm();
        } catch (err: any) {
            console.error("Failed to create order", err);
            alert("Failed to create order: " + (err?.message || String(err)));
        }
    };

    const handleSaveDelivery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) {
            alert("No order selected.");
            return;
        }

        const qty = parseFloat(deliveryForm.deliveredQtyTons);
        if (Number.isNaN(qty) || qty <= 0) {
            alert("Delivered quantity (tons) must be a positive number.");
            return;
        }
        if (!deliveryForm.contractorName.trim()) {
            alert("Contractor name is required.");
            return;
        }
        if (!deliveryForm.truckNumber.trim()) {
            alert("Truck number is required.");
            return;
        }
        if (!deliveryForm.driverName.trim()) {
            alert("Driver name is required.");
            return;
        }

        // This is the payload we will send to the backend
        const baseDelivery = {
            deliveryDate: deliveryForm.deliveryDate || todayDate(),
            deliveredQtyTons: qty,
            contractorName: deliveryForm.contractorName.trim(),
            truckNumber: deliveryForm.truckNumber.trim(),
            trailer1Number: deliveryForm.trailer1Number.trim(),
            trailer2Number: deliveryForm.trailer2Number.trim(),
            driverName: deliveryForm.driverName.trim(),
            driverIdNumber: deliveryForm.driverIdNumber.trim(),
            driverCell: deliveryForm.driverCell.trim(),
            loadingAddress: deliveryForm.loadingAddress.trim(),
            loadingNumber: deliveryForm.loadingNumber.trim(),
            loadingDatetime: deliveryForm.loadingDatetime.trim(),
            receiptDate: deliveryForm.receiptDate || "",
            receiptNumber: deliveryForm.receiptNumber.trim(),
            receiptRemarks: deliveryForm.receiptRemarks.trim(),
        };

        try {
            const payload = {
                delivery_date: baseDelivery.deliveryDate,
                delivered_qty_tons: baseDelivery.deliveredQtyTons,
                contractor_name: baseDelivery.contractorName,
                truck_number: baseDelivery.truckNumber,
                trailer1_number: baseDelivery.trailer1Number || undefined,
                trailer2_number: baseDelivery.trailer2Number || undefined,
                driver_name: baseDelivery.driverName,
                driver_id_number: baseDelivery.driverIdNumber || undefined,
                driver_cell: baseDelivery.driverCell || undefined,
                loading_address: baseDelivery.loadingAddress || undefined,
                loading_number: baseDelivery.loadingNumber || undefined,
                loading_datetime: baseDelivery.loadingDatetime || undefined,
                receipt_date: baseDelivery.receiptDate || undefined,
                receipt_number: baseDelivery.receiptNumber || undefined,
                receipt_remarks: baseDelivery.receiptRemarks || undefined,
            };

            if (editingDeliveryId) {
                // UPDATE existing delivery in backend
                await updateDelivery(selectedOrder.id, editingDeliveryId, payload);
            } else {
                // CREATE new delivery in backend
                await createDelivery(selectedOrder.id, payload);
            }

            // Refresh deliveries for this order from backend
            await loadDeliveriesFromApi(selectedOrder.id);

            // Reset form + UI
            setDeliveryForm(blankDeliveryForm);
            setEditingDeliveryId(null);
            setShowDeliveryForm(false);
        } catch (err) {
            console.error("Error saving delivery:", err);
            alert("Could not save delivery. See console for details.");
        }
    };

    const handleEditDelivery = (delivery: Delivery) => {
        setEditingDeliveryId(delivery.id);
        setShowDeliveryForm(true);
        setDeliveryForm({
            deliveryDate: delivery.deliveryDate || todayDate(),
            deliveredQtyTons: delivery.deliveredQtyTons.toString(),
            contractorName: delivery.contractorName || "",
            truckNumber: delivery.truckNumber || "",
            trailer1Number: delivery.trailer1Number || "",
            trailer2Number: delivery.trailer2Number || "",
            driverName: delivery.driverName || "",
            driverIdNumber: delivery.driverIdNumber || "",
            driverCell: delivery.driverCell || "",
            loadingAddress: delivery.loadingAddress || "",
            loadingNumber: delivery.loadingNumber || "",
            loadingDatetime: delivery.loadingDatetime || nowDatetimeLocal(),
            receiptDate: delivery.receiptDate || "",
            receiptNumber: delivery.receiptNumber || "",
            receiptRemarks: delivery.receiptRemarks || "",
        });
    };

    const handleDeleteDelivery = async (deliveryId: string) => {
        if (!window.confirm("Delete this delivery?")) return;

        if (!selectedOrder) {
            alert("No order selected.");
            return;
        }

        try {
            // Delete in Supabase
            await deleteDelivery(selectedOrder.id, deliveryId);

            // Reload deliveries for this order from API so UI is in sync
            await loadDeliveriesFromApi(selectedOrder.id);
        } catch (err) {
            console.error("Failed to delete delivery:", err);
            alert("Could not delete delivery on server.");
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!window.confirm("Delete this order and all its deliveries?")) return;

        try {
            // Delete in Supabase
            await deleteOrder(orderId);

            // Update local UI state
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            setDeliveries((prev) => prev.filter((d) => d.orderId !== orderId));
            if (selectedOrderId === orderId) {
                setSelectedOrderId(null);
            }
        } catch (err) {
            console.error("Failed to delete order:", err);
            alert("Could not delete order on server.");
        }
    };

    const handleEditOrder = async (order: Order) => {
        // 1) Ask for all the editable fields

        const newOrderNumber = window.prompt(
            "Edit order number",
            order.orderNumber
        );
        if (newOrderNumber === null) return; // Cancel = abort edit

        const newSupplierName = window.prompt(
            "Edit supplier name",
            order.supplierName
        );
        if (newSupplierName === null) return;

        const newContactPersonPrompt = window.prompt(
            "Edit supplier contact person",
            order.supplierContactPerson || ""
        );
        if (newContactPersonPrompt === null) return;
        const newContactPerson = newContactPersonPrompt;

        const newContactPhonePrompt = window.prompt(
            "Edit supplier contact phone",
            order.supplierContactPhone || ""
        );
        if (newContactPhonePrompt === null) return;
        const newContactPhone = newContactPhonePrompt;

        const newEmailPrompt = window.prompt(
            "Edit supplier email",
            order.supplierEmail || ""
        );
        if (newEmailPrompt === null) return;
        const newEmail = newEmailPrompt;

        const newSkuPrompt = window.prompt(
            "Edit SKU",
            order.sku || ""
        );
        if (newSkuPrompt === null) return;
        const newSku = newSkuPrompt;

        const newPackagingPrompt = window.prompt(
            "Edit packaging",
            order.packagingType || ""
        );
        if (newPackagingPrompt === null) return;
        const newPackaging = newPackagingPrompt;

        const newQtyStr = window.prompt(
            `Edit ordered quantity (tons) for order ${order.orderNumber}:`,
            order.orderedQtyTons.toString()
        );
        if (newQtyStr === null) return;

        const newQty = Number(newQtyStr);
        if (!Number.isFinite(newQty) || newQty < 0) {
            alert("Please enter a valid non-negative number for tons.");
            return;
        }

        try {
            // 2) Build payload in snake_case for the backend
            const payload: CreateOrderPayload = {
                order_number: newOrderNumber,
                supplier_name: newSupplierName,
                supplier_contact_person: newContactPerson,
                supplier_contact_phone: newContactPhone,
                supplier_email: newEmail,
                sku: newSku,
                packaging_type: newPackaging,
                ordered_qty_tons: newQty,
                delivered_qty_tons: order.deliveredQtyTons, // keep delivered as is
                status: order.status,
                order_date: order.orderDate, // already "YYYY-MM-DD"
            };

            const updated = await updateOrder(order.id, payload);

            // 3) Update local state so UI refreshes
            setOrders((prev) =>
                prev.map((o) =>
                    o.id === order.id
                        ? {
                            ...o,
                            orderNumber: updated.order_number,
                            supplierName: updated.supplier_name,
                            supplierContactPerson:
                                updated.supplier_contact_person ?? "",
                            supplierContactPhone:
                                updated.supplier_contact_phone ?? "",
                            supplierEmail: updated.supplier_email ?? "",
                            sku: updated.sku,
                            packagingType: updated.packaging_type ?? "",
                            orderedQtyTons: Number(updated.ordered_qty_tons),
                            deliveredQtyTons: Number(updated.delivered_qty_tons),
                            status: updated.status as OrderStatus,
                        }
                        : o
                )
            );
        } catch (err) {
            console.error("Failed to edit order", err);
            alert("Could not update order on server.");
        }
    };

    const handleCompleteOrder = async (order: Order) => {
        if (!window.confirm(`Mark order ${order.orderNumber} as COMPLETE?`)) {
            return;
        }

        try {
            // Build the payload in snake_case (what the backend expects)
            // AFTER
            const payload = {
                order_number: order.orderNumber,
                supplier_name: order.supplierName,
                supplier_contact_person: order.supplierContactPerson || "",
                supplier_contact_phone: order.supplierContactPhone || "",
                supplier_email: order.supplierEmail || "",
                sku: order.sku,
                packaging_type: order.packagingType || "",
                ordered_qty_tons: order.orderedQtyTons,
                delivered_qty_tons: order.deliveredQtyTons, // keep current delivered amount
                status: "Closed",
                order_date: order.orderDate, // already "YYYY-MM-DD"
            };

            const updated = await updateOrder(order.id, payload);

            // Update local state so UI refreshes
            setOrders((prev) =>
                prev.map((o) =>
                    o.id === order.id
                        ? {
                            ...o,
                            status: "Closed",
                            deliveredQtyTons: Number(updated.delivered_qty_tons ?? o.deliveredQtyTons),
                        }
                        : o
                )
            );
        } catch (err) {
            console.error("Failed to complete order", err);
            alert("Could not complete order on server.");
        }
    };

    const handleSoftCleanupClosedOlderThanMonths = (months: number) => {
        const now = new Date();
        const cutoff = new Date(
            now.getFullYear(),
            now.getMonth() - months,
            now.getDate()
        );

        const remainingOrders: Order[] = [];
        const removedOrderIds: string[] = [];

        orders.forEach((o) => {
            if (o.status === "Closed" && new Date(o.orderDate) < cutoff) {
                removedOrderIds.push(o.id);
            } else {
                remainingOrders.push(o);
            }
        });

        if (!removedOrderIds.length) {
            alert("No closed orders older than the selected age.");
            return;
        }

        setOrders(remainingOrders);
        setDeliveries((prev) =>
            prev.filter((d) => !removedOrderIds.includes(d.orderId))
        );
        if (selectedOrderId && removedOrderIds.includes(selectedOrderId)) {
            setSelectedOrderId(null);
        }
    };

    const handleGoHome = () => {
        setSelectedOrderId(null);
        setShowNewOrderForm(false);
        setShowDeliveryForm(false);
        setEditingDeliveryId(null);
        setDeliveryForm(blankDeliveryForm);
        setShowTransporters(false);
    };

    const startNewDeliveryForOrder = () => {
        setEditingDeliveryId(null);
        setDeliveryForm(blankDeliveryForm);
        setShowDeliveryForm((s) => !s);
    };

    // ---------- PRINT LAYOUTS ----------

    const buildOrderHeaderHtml = (order: Order): string => {
        const outstanding = order.orderedQtyTons - order.deliveredQtyTons;

        return `
      <h1>Order History</h1>
      <table class="header-table">
        <tbody>
          <tr><td>Customer:</td><td>All Size Packaging (Pty) Ltd</td></tr>
          <tr><td>Order Number:</td><td>${order.orderNumber}</td></tr>
          <tr><td>Supplier:</td><td>${order.supplierName}</td></tr>
          <tr><td>Product:</td><td>${order.sku}</td></tr>
          <tr><td>Order Qty (t):</td><td>${order.orderedQtyTons.toFixed(
            3
        )}</td></tr>
          <tr><td>Outstanding Qty:</td><td>${outstanding.toFixed(
            3
        )}</td></tr>
          <tr><td>Packaging:</td><td>${order.packagingType}</td></tr>
        </tbody>
      </table>
    `;
    };

    const handlePrintOrderHistory = (order: Order) => {
        const orderDeliveries = deliveries
            .filter((d) => d.orderId === order.id)
            .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));

        const headerHtml = buildOrderHeaderHtml(order);

        const colHeaders = orderDeliveries
            .map((_, idx) => `<th>Delivery ${idx + 1}</th>`)
            .join("");

        const buildRow = (
            label: string,
            getter: (d: Delivery) => string
        ) => {
            const cells = orderDeliveries
                .map((d) => `<td>${getter(d)}</td>`)
                .join("");
            return `<tr><td>${label}</td>${cells}</tr>`;
        };

        const detailTable = `
      <div class="section-title">Delivery Detail</div>
      <table>
        <thead>
          <tr>
            <th>&nbsp;</th>
            ${colHeaders}
          </tr>
        </thead>
        <tbody>
          ${buildRow("Contractor:", (d) => d.contractorName || "")}
          ${buildRow("Truck Reg No:", (d) => d.truckNumber || "")}
          ${buildRow("Trailer 1 Reg No:", (d) => d.trailer1Number || "")}
          ${buildRow("Trailer 2 Reg No:", (d) => d.trailer2Number || "")}
          ${buildRow("Driver Name:", (d) => d.driverName || "")}
          ${buildRow("Driver ID:", (d) => d.driverIdNumber || "")}
          ${buildRow("Supplier Loading No:", (d) => d.loadingNumber || "")}
          ${buildRow("Loading Address:", (d) => d.loadingAddress || "")}
          ${buildRow("Loading Time Slot:", (d) =>
            d.loadingDatetime ? d.loadingDatetime.replace("T", " ") : ""
        )}
          ${buildRow("Qty Received:", (d) =>
            isReceived(d) ? d.deliveredQtyTons.toFixed(3) : ""
        )}
          ${buildRow("Date Received:", (d) => d.receiptDate || "")}
        </tbody>
      </table>
    `;

        const noteHtml = `
      <p style="margin-top:16px;font-size:11px;">
        Note: Supplier to ensure product is of good quality.
      </p>
    `;

        openPrintWindow(headerHtml + detailTable + noteHtml, "Order History");
    };

    const handlePrintNewOrder = (order: Order) => {
        const outstanding = order.orderedQtyTons - order.deliveredQtyTons;

        const html = `
      <h1>Customer Order Detail (New Order)</h1>
      <table class="header-table">
        <tbody>
          <tr><td>Customer:</td><td>All Size Packaging (Pty) Ltd</td></tr>
          <tr><td>Order Number:</td><td>${order.orderNumber}</td></tr>
          <tr><td>Product:</td><td>${order.sku}</td></tr>
          <tr><td>Order Qty (t):</td><td>${order.orderedQtyTons.toFixed(
            3
        )}</td></tr>
          <tr><td>Outstanding Qty:</td><td>${outstanding.toFixed(
            3
        )}</td></tr>
          <tr><td>Packaging:</td><td>${order.packagingType}</td></tr>
        </tbody>
      </table>
      <p style="margin-top:16px;font-size:11px;">
        Note: Supplier to ensure product is of good quality.
      </p>
    `;
        openPrintWindow(html, "New Order");
    };

    const handlePrintLoadingDetails = (order: Order, delivery: Delivery) => {
        const outstanding = order.orderedQtyTons - order.deliveredQtyTons;

        const html = `
      <h1>Loading Details</h1>

      <div class="section-title">Customer Order Detail</div>
      <table class="header-table">
        <tbody>
          <tr><td>Customer:</td><td>All Size Packaging (Pty) Ltd</td></tr>
          <tr><td>Order Number:</td><td>${order.orderNumber}</td></tr>
          <tr><td>Product:</td><td>${order.sku}</td></tr>
          <tr><td>Order Qty (t):</td><td>${order.orderedQtyTons.toFixed(
            3
        )}</td></tr>
          <tr><td>Outstanding Qty:</td><td>${outstanding.toFixed(
            3
        )}</td></tr>
          <tr><td>Packaging:</td><td>${order.packagingType}</td></tr>
        </tbody>
      </table>
      <p style="margin-top:8px;font-size:11px;">
        Note: Supplier to ensure product is of good quality.
      </p>

      <div class="section-title">Transport Contractor Information</div>
      <table class="header-table">
        <tbody>
          <tr><td>Contractor:</td><td>${delivery.contractorName || ""}</td></tr>
          <tr><td>Truck Reg No:</td><td>${delivery.truckNumber || ""}</td></tr>
          <tr><td>Trailer 1 Reg No:</td><td>${delivery.trailer1Number || ""}</td></tr>
          <tr><td>Trailer 2 Reg No:</td><td>${delivery.trailer2Number || ""}</td></tr>
          <tr><td>Driver Name:</td><td>${delivery.driverName || ""}</td></tr>
          <tr><td>Driver ID:</td><td>${delivery.driverIdNumber || ""}</td></tr>
          <tr><td>Supplier Loading No:</td><td>${delivery.loadingNumber || ""}</td></tr>
          <tr><td>Loading Address:</td><td>${delivery.loadingAddress || ""}</td></tr>
          <tr><td>Loading Time Slot:</td><td>${delivery.loadingDatetime
                ? delivery.loadingDatetime.replace("T", " ")
                : ""
            }</td></tr>
        </tbody>
      </table>
    `;

        openPrintWindow(html, "Loading Details");
    };

    const handleExportOrderHistoryCsv = (order: Order) => {
        const orderDeliveries = deliveries
            .filter((d) => d.orderId === order.id)
            .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));

        const outstanding = order.orderedQtyTons - order.deliveredQtyTons;

        // helper to escape values for CSV
        const csvCell = (val: string | number) =>
            `"${String(val ?? "").replace(/"/g, '""')}"`;

        const row = (cells: (string | number)[]) =>
            cells.map(csvCell).join(",");

        const lines: string[] = [];

        // --- Header block (2 columns: label, value) ---
        lines.push(row(["Order History"]));
        lines.push(row(["Customer", "All Size Packaging (Pty) Ltd"]));
        lines.push(row(["Order Number", order.orderNumber]));
        lines.push(row(["Supplier", order.supplierName]));
        lines.push(row(["Product", order.sku]));
        lines.push(row(["Order Qty (t)", order.orderedQtyTons.toFixed(3)]));
        lines.push(row(["Outstanding Qty", outstanding.toFixed(3)]));
        lines.push(row(["Packaging", order.packagingType]));
        lines.push(""); // blank line

        // --- Delivery detail matrix ---
        lines.push(row(["Delivery Detail"]));

        const headerRow = [
            "Field",
            ...orderDeliveries.map((_, idx) => `Delivery ${idx + 1}`),
        ];
        lines.push(row(headerRow));

        const addDetailRow = (label: string, getter: (d: Delivery) => string) => {
            lines.push(
                row([
                    label,
                    ...orderDeliveries.map((d) => getter(d) || ""),
                ])
            );
        };

        addDetailRow("Contractor", (d) => d.contractorName || "");
        addDetailRow("Truck Reg No", (d) => d.truckNumber || "");
        addDetailRow("Trailer 1 Reg No", (d) => d.trailer1Number || "");
        addDetailRow("Trailer 2 Reg No", (d) => d.trailer2Number || "");
        addDetailRow("Driver Name", (d) => d.driverName || "");
        addDetailRow("Driver ID", (d) => d.driverIdNumber || "");
        addDetailRow("Supplier Loading No", (d) => d.loadingNumber || "");
        addDetailRow("Loading Address", (d) => d.loadingAddress || "");
        addDetailRow("Loading Time Slot", (d) =>
            d.loadingDatetime ? d.loadingDatetime.replace("T", " ") : ""
        );
        addDetailRow("Qty Received", (d) =>
            isReceived(d) ? d.deliveredQtyTons.toFixed(3) : ""
        );
        addDetailRow("Date Received", (d) => d.receiptDate || "");

        const csv = lines.join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Order_${order.orderNumber}_history.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ---------- EMAIL HELPERS (TEXT MIRRORING PRINT LAYOUTS) ----------

    const sendMail = (subject: string, body: string) => {
        const mailto = `mailto:?subject=${encodeURIComponent(
            subject
        )}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
    };

    const handleEmailOrderHistory = (order: Order) => {
        const outstanding = order.orderedQtyTons - order.deliveredQtyTons;
        const orderDeliveries = deliveries
            .filter((d) => d.orderId === order.id)
            .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));

        const subject = `Order history for order ${order.orderNumber}`;

        const lines: string[] = [];
        lines.push("ORDER HISTORY");
        lines.push("========================");
        lines.push("Customer: All Size Packaging (Pty) Ltd");
        lines.push(`Order Number: ${order.orderNumber}`);
        lines.push(`Supplier: ${order.supplierName}`);
        lines.push(`Product: ${order.sku}`);
        lines.push(`Order Qty (t): ${order.orderedQtyTons.toFixed(3)}`);
        lines.push(`Outstanding Qty: ${outstanding.toFixed(3)}`);
        lines.push(`Packaging: ${order.packagingType}`);
        lines.push("");
        lines.push("DELIVERY DETAIL");
        lines.push("------------------------");

        if (orderDeliveries.length === 0) {
            lines.push("No deliveries captured yet.");
        } else {
            orderDeliveries.forEach((d, idx) => {
                lines.push(`Delivery ${idx + 1}`);
                lines.push(`  Contractor: ${d.contractorName || ""}`);
                lines.push(`  Truck Reg No: ${d.truckNumber || ""}`);
                lines.push(`  Trailer 1 Reg No: ${d.trailer1Number || ""}`);
                lines.push(`  Trailer 2 Reg No: ${d.trailer2Number || ""}`);
                lines.push(`  Driver Name: ${d.driverName || ""}`);
                lines.push(`  Driver ID: ${d.driverIdNumber || ""}`);
                lines.push(`  Supplier Loading No: ${d.loadingNumber || ""}`);
                lines.push(`  Loading Address: ${d.loadingAddress || ""}`);
                lines.push(
                    `  Loading Time Slot: ${d.loadingDatetime ? d.loadingDatetime.replace("T", " ") : ""
                    }`
                );
                lines.push(
                    `  Qty Received: ${isReceived(d) ? d.deliveredQtyTons.toFixed(3) : ""
                    }`
                );
                lines.push(`  Date Received: ${d.receiptDate || ""}`);
                lines.push("");
            });
        }

        lines.push(
            "Note: Supplier to ensure product is of good quality."
        );

        sendMail(subject, lines.join("\n"));
    };

    const handleEmailNewOrder = (order: Order) => {
        const outstanding = order.orderedQtyTons - order.deliveredQtyTons;

        const subject = `Customer order detail (new order ${order.orderNumber})`;
        const lines: string[] = [];

        lines.push("CUSTOMER ORDER DETAIL (NEW ORDER)");
        lines.push("=================================");
        lines.push("Customer: All Size Packaging (Pty) Ltd");
        lines.push(`Order Number: ${order.orderNumber}`);
        lines.push(`Product: ${order.sku}`);
        lines.push(`Order Qty (t): ${order.orderedQtyTons.toFixed(3)}`);
        lines.push(`Outstanding Qty: ${outstanding.toFixed(3)}`);
        lines.push(`Packaging: ${order.packagingType}`);
        lines.push("");
        lines.push(
            "Note: Supplier to ensure product is of good quality."
        );

        sendMail(subject, lines.join("\n"));
    };

    const handleEmailLoadingDetails = (order: Order, delivery: Delivery) => {
        const outstanding = order.orderedQtyTons - order.deliveredQtyTons;

        const subject = `Loading details for order ${order.orderNumber}`;
        const lines: string[] = [];

        lines.push("LOADING DETAILS");
        lines.push("========================");
        lines.push("");
        lines.push("Customer Order Detail");
        lines.push("---------------------");
        lines.push("Customer: All Size Packaging (Pty) Ltd");
        lines.push(`Order Number: ${order.orderNumber}`);
        lines.push(`Product: ${order.sku}`);
        lines.push(`Order Qty (t): ${order.orderedQtyTons.toFixed(3)}`);
        lines.push(`Outstanding Qty: ${outstanding.toFixed(3)}`);
        lines.push(`Packaging: ${order.packagingType}`);
        lines.push("");
        lines.push(
            "Note: Supplier to ensure product is of good quality."
        );
        lines.push("");
        lines.push("Transport Contractor Information");
        lines.push("--------------------------------");
        lines.push(`Contractor: ${delivery.contractorName || ""}`);
        lines.push(`Truck Reg No: ${delivery.truckNumber || ""}`);
        lines.push(`Trailer 1 Reg No: ${delivery.trailer1Number || ""}`);
        lines.push(`Trailer 2 Reg No: ${delivery.trailer2Number || ""}`);
        lines.push(`Driver Name: ${delivery.driverName || ""}`);
        lines.push(`Driver ID: ${delivery.driverIdNumber || ""}`);
        lines.push(`Supplier Loading No: ${delivery.loadingNumber || ""}`);
        lines.push(`Loading Address: ${delivery.loadingAddress || ""}`);
        lines.push(
            `Loading Time Slot: ${delivery.loadingDatetime
                ? delivery.loadingDatetime.replace("T", " ")
                : ""
            }`
        );

        sendMail(subject, lines.join("\n"));
    };

    // ---------- RENDER ----------

    if (showTransporters) {
        return (
            <TransporterDetails onBack={() => setShowTransporters(false)} />
        );
    }

    return (
        <div
            style={{
                padding: "1rem 2rem 2rem",
                maxWidth: 1200,
                margin: "0 auto",
            }}
        >
            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                }}
            >
                <h1>Truck Logistics – Supplier Orders &amp; Deliveries</h1>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        type="button"
                        onClick={() => setShowTransporters(true)}
                        style={{
                            padding: "0.4rem 0.9rem",
                            borderRadius: 4,
                            border: "1px solid #b00020",
                            backgroundColor: "#b00020",
                            color: "white",
                            cursor: "pointer",
                        }}
                    >
                        Transporter Details
                    </button>
                    <button
                        type="button"
                        onClick={handleGoHome}
                        style={{
                            padding: "0.4rem 0.9rem",
                            borderRadius: 4,
                            border: "1px solid #ccc",
                            backgroundColor: "#f5f5f5",
                            cursor: "pointer",
                        }}
                    >
                        Home
                    </button>
                </div>
            </header>

            {/* Top controls + New Order form */}          <section style={{ marginBottom: "1.5rem" }}>
                <div
                    style={{ display: "flex", gap: "1rem", alignItems: "center" }}
                >
                    <button
                        onClick={() => setShowNewOrderForm((s) => !s)}
                        style={{
                            padding: "0.4rem 0.9rem",
                            borderRadius: 4,
                            border: "1px solid #666",
                            cursor: "pointer",
                        }}
                    >
                        {showNewOrderForm ? "Cancel New Order" : "New Supplier Order"}
                    </button>

                    <label>
                        <input
                            type="checkbox"
                            checked={showClosedOrders}
                            onChange={(e) => setShowClosedOrders(e.target.checked)}
                        />{" "}
                        Show closed orders
                    </label>

                    <button
                        type="button"
                        onClick={() => {
                            const monthsStr = prompt(
                                "Delete closed orders older than how many months?",
                                "6"
                            );
                            if (!monthsStr) return;
                            const m = parseInt(monthsStr, 10);
                            if (Number.isNaN(m) || m <= 0) {
                                alert("Please enter a positive number of months.");
                                return;
                            }
                            handleSoftCleanupClosedOlderThanMonths(m);
                        }}
                        style={{
                            padding: "0.4rem 0.9rem",
                            borderRadius: 4,
                            border: "1px solid #666",
                            cursor: "pointer",
                        }}
                    >
                        Cleanup old closed orders
                    </button>
                </div>

                {/* New Order Form */}
                {showNewOrderForm && (
                    <form
                        onSubmit={handleCreateOrder}
                        style={{
                            marginTop: "1rem",
                            padding: "1rem 1.4rem 1.25rem",
                            border: "1px solid #ccc",
                            borderRadius: 6,
                            backgroundColor: "#fafafa",
                        }}
                    >
                        <h2 style={{ marginTop: 0, marginBottom: "0.8rem" }}>
                            New Supplier Order
                        </h2>

                        {/* Row 1 – green band */}
                        <div style={row4Style("#e3f3d8")}>
                            <div>
                                <label style={labelStyle}>Date</label>
                                <input
                                    type="date"
                                    name="orderDate"
                                    value={orderForm.orderDate}
                                    onChange={handleOrderFormChange}
                                    style={inputStyle}
                                />
                            </div>

                            <SmartDropdown
                                label="SKU (Raw Material)****"
                                name="sku"
                                value={orderForm.sku}
                                onChange={handleOrderFormChange as any}
                                storageKey="skuHistory"
                                required
                                placeholder="Type or pick SKU"
                            />

                            <SmartDropdown
                                label="Packaging"
                                name="packagingType"
                                value={orderForm.packagingType}
                                onChange={handleOrderFormChange as any}
                                storageKey="packagingHistory"
                                placeholder="Bulk, 1t bags, etc."
                            />

                            <div>
                                <label style={labelStyle}>Order number*</label>
                                <input
                                    type="text"
                                    name="orderNumber"
                                    value={orderForm.orderNumber}
                                    onChange={handleOrderFormChange}
                                    autoComplete="off"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* Row 2 – yellow band */}
                        <div style={row4Style("#fff5c4")}>
                            <SmartDropdown
                                label="Supplier name****"
                                name="supplierName"
                                value={orderForm.supplierName}
                                onChange={handleOrderFormChange as any}
                                storageKey="supplierHistory"
                                required
                                placeholder="Type or pick supplier"
                            />

                            <div>
                                <label style={labelStyle}>Contact person</label>
                                <input
                                    type="text"
                                    name="supplierContactPerson"
                                    value={orderForm.supplierContactPerson}
                                    onChange={handleOrderFormChange}
                                    style={{
                                        ...inputStyle,
                                        backgroundColor: "#fffceb",
                                    }}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>Phone</label>
                                <input
                                    type="text"
                                    name="supplierContactPhone"
                                    value={orderForm.supplierContactPhone}
                                    onChange={handleOrderFormChange}
                                    style={{
                                        ...inputStyle,
                                        backgroundColor: "#fffceb",
                                    }}
                                />
                            </div>

                            <SmartDropdown
                                label="E-mail"
                                name="supplierEmail"
                                value={orderForm.supplierEmail}
                                onChange={handleOrderFormChange as any}
                                storageKey="supplierEmailHistory"
                                placeholder="Type or pick email"
                            />
                        </div>

                        {/* Row 3 – qty + button */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: "1rem",
                                marginTop: "0.4rem",
                            }}
                        >
                            <div style={{ maxWidth: 220 }}>
                                <label style={labelStyle}>Ordered Qty (tons)*</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    name="orderedQtyTons"
                                    value={orderForm.orderedQtyTons}
                                    onChange={handleOrderFormChange}
                                    style={inputStyle}
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    padding: "0.55rem 1.3rem",
                                    borderRadius: 4,
                                    border: "none",
                                    backgroundColor: "#007bff",
                                    color: "white",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    marginBottom: 1,
                                }}
                            >
                                Create Order
                            </button>
                        </div>
                    </form>
                )}
            </section>

            {/* Orders Table */}
            <section>
                <h2>Orders</h2>

                {/* ---- ORDER FILTERS ---- */}
                <div style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
                    {/* Supplier filter */}
                    <div>
                        <label>Supplier:</label><br />
                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            {supplierOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* SKU filter */}
                    <div>
                        <label>SKU:</label><br />
                        <select
                            value={skuFilter}
                            onChange={(e) => setSkuFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            {skuOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status filter */}
                    <div>
                        <label>Status:</label><br />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            {statusOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>


                {visibleOrders.length === 0 ? (
                    <p>No orders yet.</p>
                ) : (
                        <div style={{ maxHeight: 260, overflowY: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: 6 }}>Order #</th>
                                        <th style={{ padding: 6 }}>Date</th>
                                        <th style={{ padding: 6 }}>Supplier</th>
                                        <th style={{ padding: 6 }}>SKU</th>
                                        <th style={{ padding: 6 }}>Packaging</th>
                                        <th style={{ padding: 6, textAlign: "right" }}>Ordered (t)</th>
                                        <th style={{ padding: 6, textAlign: "right" }}>Delivered (t)</th>
                                        <th style={{ padding: 6, textAlign: "right" }}>Outstanding (t)</th>
                                        <th style={{ padding: 6 }}>Status</th>
                                        <th style={{ padding: 6 }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleOrders.map((o) => {
                                        const outstanding = o.orderedQtyTons - o.deliveredQtyTons;

                                        return (
                                            <tr
                                                key={o.id}
                                                style={{
                                                    backgroundColor:
                                                        selectedOrderId === o.id ? "#eef5ff" : "transparent",
                                                }}
                                            >
                                                <td style={{ padding: 6 }}>{o.orderNumber}</td>
                                                <td style={{ padding: 6 }}>{o.orderDate}</td>
                                                <td style={{ padding: 6 }}>{o.supplierName}</td>
                                                <td style={{ padding: 6 }}>{o.sku}</td>
                                                <td style={{ padding: 6 }}>{o.packagingType}</td>

                                                <td
                                                    style={{
                                                        padding: 6,
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {o.orderedQtyTons.toFixed(3)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: 6,
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {o.deliveredQtyTons.toFixed(3)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: 6,
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {outstanding.toFixed(3)}
                                                </td>

                                                <td style={{ padding: 6 }}>{o.status}</td>

                                                {/* Action buttons */}
                                                <td
                                                    style={{
                                                        padding: 6,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {/* View / Hide deliveries */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (selectedOrderId === o.id) {
                                                                setSelectedOrderId(null);
                                                            } else {
                                                                setSelectedOrderId(o.id);
                                                                loadDeliveriesFromApi(o.id);
                                                            }
                                                        }}
                                                        style={{
                                                            padding: "0.2rem 0.6rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #666",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        {selectedOrderId === o.id ? "Hide" : "Open"}
                                                    </button>

                                                    {/* 🔹 Edit order */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditOrder(o)}
                                                        style={{
                                                            padding: "0.2rem 0.6rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #007bff",
                                                            cursor: "pointer",
                                                            backgroundColor: "#ffffff",
                                                        }}
                                                    >
                                                        Edit
    </button>

                                                    {/* Complete order */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCompleteOrder(o)}
                                                        style={{
                                                            padding: "0.2rem 0.6rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #28a745",
                                                            backgroundColor: "#28a745",
                                                            color: "white",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Complete
    </button>

                                                    {/* Print order */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrintNewOrder(o)}
                                                        style={{
                                                            padding: "0.2rem 0.6rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #007bff",
                                                            cursor: "pointer",
                                                            backgroundColor: "#e6f0ff",
                                                        }}
                                                    >
                                                        Print Order
    </button>

                                                    {/* Email order */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEmailNewOrder(o)}
                                                        style={{
                                                            padding: "0.2rem 0.6rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #007bff",
                                                            cursor: "pointer",
                                                            backgroundColor: "#ffffff",
                                                        }}
                                                    >
                                                        E-mail
    </button>

                                                    {/* Delete order */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteOrder(o.id)}
                                                        style={{
                                                            padding: "0.2rem 0.6rem",
                                                            borderRadius: 3,
                                                            border: "1px solid #b00000",
                                                            color: "#b00000",
                                                            cursor: "pointer",
                                                            backgroundColor: "white",
                                                        }}
                                                    >
                                                        Delete
    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
            </section>

            {/* Order details & deliveries */}
            {selectedOrder && (
                <section
                    style={{
                        marginTop: "2rem",
                        borderTop: "1px solid #ddd",
                        paddingTop: "1.5rem",
                    }}
                >
                    <h2>Order Details – {selectedOrder.orderNumber}</h2>

                    {/* Order summary */}
                    <div style={{ marginBottom: "0.8rem", fontSize: 14 }}>
                        <strong>Supplier:</strong> {selectedOrder.supplierName} <br />
                        <strong>Contact:</strong>{" "}
                        {selectedOrder.supplierContactPerson || "—"}{" "}
                        {selectedOrder.supplierContactPhone &&
                            `(${selectedOrder.supplierContactPhone})`}
                        {selectedOrder.supplierEmail && (
                            <>
                                {" "}
                            | <strong>E-mail:</strong> {selectedOrder.supplierEmail}
                            </>
                        )}
                        <br />
                        <strong>SKU:</strong> {selectedOrder.sku} |{" "}
                        <strong>Packaging:</strong> {selectedOrder.packagingType}
                        <br />
                        <strong>Ordered:</strong>{" "}
                        {selectedOrder.orderedQtyTons.toFixed(3)} t |{" "}
                        <strong>Delivered (received):</strong>{" "}
                        {selectedOrder.deliveredQtyTons.toFixed(3)} t |{" "}
                        <strong>Outstanding:</strong>{" "}
                        {(
                            selectedOrder.orderedQtyTons - selectedOrder.deliveredQtyTons
                        ).toFixed(3)}{" "}
                    t
                    <br />
                        <strong>Status:</strong> {selectedOrder.status}
                    </div>

                    {/* Toolbar under Order Details */}
                    <div
                        style={{
                            marginBottom: "1rem",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                        }}
                    >
                        {/* Add / Cancel delivery */}
                        <button
                            type="button"
                            onClick={startNewDeliveryForOrder}
                            style={{
                                padding: "0.45rem 0.9rem",
                                borderRadius: 4,
                                border: "1px solid #007bff",
                                cursor: "pointer",
                                backgroundColor: "#e6f0ff",
                            }}
                        >
                            {showDeliveryForm && !editingDeliveryId
                                ? "Cancel New Delivery"
                                : editingDeliveryId
                                    ? "Cancel Edit Delivery"
                                    : "Add Delivery / Load"}
                        </button>

                        {/* Order history actions */}
                        <button
                            type="button"
                            onClick={() => handlePrintOrderHistory(selectedOrder)}
                            style={{
                                padding: "0.45rem 0.9rem",
                                borderRadius: 4,
                                border: "1px solid #666",
                                cursor: "pointer",
                                backgroundColor: "white",
                            }}
                        >
                            Print Order History
                    </button>
                        <button
                            type="button"
                            onClick={() => handleExportOrderHistoryCsv(selectedOrder)}
                            style={{
                                padding: "0.45rem 0.9rem",
                                borderRadius: 4,
                                border: "1px solid #666",
                                cursor: "pointer",
                                backgroundColor: "white",
                            }}
                        >
                            Export Order History (CSV)
                    </button>
                        <button
                            type="button"
                            onClick={() => handleEmailOrderHistory(selectedOrder)}
                            style={{
                                padding: "0.45rem 0.9rem",
                                borderRadius: 4,
                                border: "1px solid #666",
                                cursor: "pointer",
                                backgroundColor: "white",
                            }}
                        >
                            E-mail Order History
                    </button>
                    </div>

                    {/* Delivery form */}
                    {showDeliveryForm && (
                        <form
                            onSubmit={handleSaveDelivery}
                            style={{
                                marginBottom: "1.5rem",
                                padding: "1rem 1.4rem",
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                backgroundColor: "#f7fafc",
                            }}
                        >
                            <h3 style={{ marginTop: 0, marginBottom: "0.8rem" }}>
                                {editingDeliveryId
                                    ? `Edit Delivery for Order ${selectedOrder.orderNumber}`
                                    : `New Delivery for Order ${selectedOrder.orderNumber}`}
                            </h3>

                            {/* Row 1 */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap: "0.75rem",
                                    marginBottom: "0.75rem",
                                }}
                            >
                                <div>
                                    <label style={{ display: "block", fontSize: 12 }}>
                                        Delivery Date
                                </label>
                                    <input
                                        type="date"
                                        name="deliveryDate"
                                        value={deliveryForm.deliveryDate}
                                        onChange={handleDeliveryFormChange}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12 }}>
                                        Delivered Qty (t)
                                </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        name="deliveredQtyTons"
                                        value={deliveryForm.deliveredQtyTons}
                                        onChange={handleDeliveryFormChange}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12 }}>
                                        Packaging
                                </label>
                                    <input
                                        type="text"
                                        value={selectedOrder.packagingType}
                                        readOnly
                                        style={{
                                            ...inputStyle,
                                            backgroundColor: "#f0f0f0",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Row 2 – contractor / driver / truck */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                    gap: "0.75rem",
                                    marginBottom: "0.75rem",
                                }}
                            >
                                <SmartDropdown
                                    label="Contractor Name****"
                                    name="contractorName"
                                    value={deliveryForm.contractorName}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="contractorHistory"
                                    required
                                    placeholder="Type or pick contractor"
                                />
                                <SmartDropdown
                                    label="Driver****"
                                    name="driverName"
                                    value={deliveryForm.driverName}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="driverHistory"
                                    required
                                    placeholder="Type or pick driver"
                                />
                                <SmartDropdown
                                    label="Driver ID"
                                    name="driverIdNumber"
                                    value={deliveryForm.driverIdNumber}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="driverIdHistory"
                                    placeholder="Type or pick driver ID"
                                />
                                <SmartDropdown
                                    label="Driver Cell"
                                    name="driverCell"
                                    value={deliveryForm.driverCell}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="driverCellHistory"
                                    placeholder="Type or pick driver cell"
                                />
                                <SmartDropdown
                                    label="Truck Number****"
                                    name="truckNumber"
                                    value={deliveryForm.truckNumber}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="truckHistory"
                                    required
                                    placeholder="Type or pick truck"
                                />
                                <SmartDropdown
                                    label="Trailer 1 Number"
                                    name="trailer1Number"
                                    value={deliveryForm.trailer1Number}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="trailer1History"
                                    placeholder="Type or pick trailer 1"
                                />
                                <SmartDropdown
                                    label="Trailer 2 Number"
                                    name="trailer2Number"
                                    value={deliveryForm.trailer2Number}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="trailer2History"
                                    placeholder="Type or pick trailer 2"
                                />
                            </div>

                            {/* Row 3 – loading & receipt info */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: "0.75rem",
                                    marginBottom: "0.75rem",
                                }}
                            >
                                <div>
                                    <label style={{ display: "block", fontSize: 12 }}>
                                        Loading Number
                                </label>
                                    <input
                                        type="text"
                                        name="loadingNumber"
                                        value={deliveryForm.loadingNumber}
                                        onChange={handleDeliveryFormChange}
                                        style={inputStyle}
                                    />
                                </div>
                                <AutocompleteWithHistory
                                    label="Loading Address"
                                    name="loadingAddress"
                                    value={deliveryForm.loadingAddress}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="loadingAddressHistory"
                                    placeholder="Type or pick loading address"
                                />
                                <div>
                                    <label style={{ display: "block", fontSize: 12 }}>
                                        Loading Datetime
                                </label>
                                    <input
                                        type="datetime-local"
                                        name="loadingDatetime"
                                        value={deliveryForm.loadingDatetime}
                                        onChange={handleDeliveryFormChange}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12 }}>
                                        Receipt Date
                                </label>
                                    <input
                                        type="date"
                                        name="receiptDate"
                                        value={deliveryForm.receiptDate}
                                        onChange={handleDeliveryFormChange}
                                        style={{
                                            ...inputStyle,
                                            backgroundColor: "#f9f9f9",
                                        }}
                                    />
                                </div>
                                <AutocompleteWithHistory
                                    label="Receipt Remarks"
                                    name="receiptRemarks"
                                    value={deliveryForm.receiptRemarks}
                                    onChange={handleDeliveryFormChange as any}
                                    storageKey="receiptRemarksHistory"
                                    placeholder="e.g. Received OK, Short load, etc."
                                />
                            </div>

                            {/* Save button */}
                            <div style={{ textAlign: "right" }}>
                                <button
                                    type="submit"
                                    style={{
                                        padding: "0.45rem 0.9rem",
                                        borderRadius: 4,
                                        border: "1px solid #007bff",
                                        cursor: "pointer",
                                        backgroundColor: "#007bff",
                                        color: "white",
                                    }}
                                >
                                    {editingDeliveryId ? "Save Changes" : "Save Delivery"}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Deliveries table */}
                    <h3>Deliveries</h3>
                    {deliveriesForSelectedOrder.length === 0 ? (
                        <p>No deliveries captured yet.</p>
                    ) : (
                            <div style={{ maxHeight: 260, overflowY: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: 6 }}>Delivery Date</th>
                                            <th style={{ padding: 6, textAlign: "right" }}>
                                                Delivered (t)
                                    </th>
                                            <th style={{ padding: 6 }}>Contractor</th>
                                            <th style={{ padding: 6 }}>Truck</th>
                                            <th style={{ padding: 6 }}>Trailer 1</th>
                                            <th style={{ padding: 6 }}>Trailer 2</th>
                                            <th style={{ padding: 6 }}>Driver</th>
                                            <th style={{ padding: 6 }}>Driver Cell</th>
                                            <th style={{ padding: 6 }}>Loading No.</th>
                                            <th style={{ padding: 6 }}>Loading Address</th>
                                            <th style={{ padding: 6 }}>Loading Datetime</th>
                                            <th style={{ padding: 6 }}>Receipt Date</th>
                                            <th style={{ padding: 6 }}>Receipt Remarks</th>
                                            <th style={{ padding: 6 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deliveriesForSelectedOrder.map((d) => (
                                            <tr key={d.id}>
                                                <td style={{ padding: 6 }}>{d.deliveryDate}</td>
                                                <td
                                                    style={{
                                                        padding: 6,
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    {d.deliveredQtyTons.toFixed(3)}
                                                </td>
                                                <td style={{ padding: 6 }}>{d.contractorName}</td>
                                                <td style={{ padding: 6 }}>{d.truckNumber}</td>
                                                <td style={{ padding: 6 }}>
                                                    {d.trailer1Number || "—"}
                                                </td>
                                                <td style={{ padding: 6 }}>
                                                    {d.trailer2Number || "—"}
                                                </td>
                                                <td style={{ padding: 6 }}>{d.driverName}</td>
                                                <td style={{ padding: 6 }}>{d.driverCell}</td>
                                                <td style={{ padding: 6 }}>
                                                    {d.loadingNumber || "—"}
                                                </td>
                                                <td style={{ padding: 6 }}>
                                                    {d.loadingAddress || "—"}
                                                </td>
                                                <td style={{ padding: 6 }}>
                                                    {d.loadingDatetime
                                                        ? d.loadingDatetime.replace("T", " ")
                                                        : "—"}
                                                </td>
                                                <td style={{ padding: 6 }}>
                                                    {d.receiptDate || "—"}
                                                </td>
                                                <td style={{ padding: 6 }}>
                                                    {d.receiptRemarks || "—"}
                                                </td>
                                                <td style={{ padding: 6, whiteSpace: "nowrap" }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditDelivery(d)}
                                                        style={{
                                                            padding: "0.2rem 0.5rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #666",
                                                            cursor: "pointer",
                                                            backgroundColor: "white",
                                                        }}
                                                    >
                                                        Edit
                                            </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handlePrintLoadingDetails(
                                                                selectedOrder,
                                                                d
                                                            )
                                                        }
                                                        style={{
                                                            padding: "0.2rem 0.5rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #007bff",
                                                            cursor: "pointer",
                                                            backgroundColor: "#e6f0ff",
                                                        }}
                                                    >
                                                        Loading Detail
                                            </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleEmailLoadingDetails(
                                                                selectedOrder,
                                                                d
                                                            )
                                                        }
                                                        style={{
                                                            padding: "0.2rem 0.5rem",
                                                            marginRight: 4,
                                                            borderRadius: 3,
                                                            border: "1px solid #007bff",
                                                            cursor: "pointer",
                                                            backgroundColor: "#ffffff",
                                                        }}
                                                    >
                                                        E-mail
                                            </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDeleteDelivery(d.id)
                                                        }
                                                        style={{
                                                            padding: "0.2rem 0.5rem",
                                                            borderRadius: 3,
                                                            border: "1px solid #b00000",
                                                            color: "#b00000",
                                                            cursor: "pointer",
                                                            backgroundColor: "white",
                                                        }}
                                                    >
                                                        Delete
                                            </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                </section>
            )}

        </div>
    );

};

export default TruckLogisticsApp;
