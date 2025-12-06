import React, {
    useEffect,
    useState,
    CSSProperties,
    ChangeEvent,
    FormEvent,
} from "react";
import {
    getTransporters,
    createTransporter,
    updateTransporter,
    deleteTransporter,
    type ApiTransporterRow,
    type CreateTransporterPayload,
} from "./api";

// ---------- TYPES ----------

interface Transporter {
    id: string;
    name: string;
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
}

interface TransporterFormState {
    name: string;
    contactPerson: string;
    cellNo: string;
    email: string;
    hasTippers: boolean;
    hasFlatbeds: boolean;
    hasTautliners: boolean;
    tipperRateDbn: string;
    tipperRateRb: string;
    flatbedRateDbn: string;
    flatbedRateRb: string;
    comments: string;
}

interface TransporterDetailsProps {
    onBack?: () => void;
}

// ---------- HELPERS ----------

function fromApi(row: ApiTransporterRow): Transporter {
    return {
        id: row.id,
        name: row.name,
        contactPerson: row.contact_person ?? "",
        cellNo: row.cell_no ?? "",
        email: row.email ?? "",
        hasTippers: !!row.has_tippers,
        hasFlatbeds: !!row.has_flatbeds,
        hasTautliners: !!row.has_tautliners,
        tipperRateDbn: row.tipper_rate_dbn ?? "",
        tipperRateRb: row.tipper_rate_rb ?? "",
        flatbedRateDbn: row.flatbed_rate_dbn ?? "",
        flatbedRateRb: row.flatbed_rate_rb ?? "",
        comments: row.comments ?? "",
    };
}

function toCreatePayload(form: TransporterFormState): CreateTransporterPayload {
    return {
        transporterName: form.name.trim(),
        contactPerson: form.contactPerson.trim() || null,
        cellNo: form.cellNo.trim() || null,
        email: form.email.trim() || null,
        hasTippers: form.hasTippers,
        hasFlatbeds: form.hasFlatbeds,
        hasTautliners: form.hasTautliners,
        tipperRateDbn: form.tipperRateDbn.trim() || null,
        tipperRateRb: form.tipperRateRb.trim() || null,
        flatbedRateDbn: form.flatbedRateDbn.trim() || null,
        flatbedRateRb: form.flatbedRateRb.trim() || null,
        comments: form.comments.trim() || null,
    };
}

// update payload is same shape as create
const toUpdatePayload = toCreatePayload;

// ---------- MAIN COMPONENT ----------

function TransporterDetails({ onBack }: TransporterDetailsProps) {
    const [transporters, setTransporters] = useState<Transporter[]>([]);
    const [form, setForm] = useState<TransporterFormState>({
        name: "",
        contactPerson: "",
        cellNo: "",
        email: "",
        hasTippers: false,
        hasFlatbeds: false,
        hasTautliners: false,
        tipperRateDbn: "",
        tipperRateRb: "",
        flatbedRateDbn: "",
        flatbedRateRb: "",
        comments: "",
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // search / filter / sort state
    const [search, setSearch] = useState("");
    const [fleetFilter, setFleetFilter] = useState<
        "all" | "tippers" | "flatbeds" | "tautliners"
    >("all");
    const [sortBy, setSortBy] = useState<
        "name" | "tipperRateDbn" | "tipperRateRb" | "flatbedRateDbn" | "flatbedRateRb"
    >("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // Load from backend
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const rows = await getTransporters();
                setTransporters(rows.map(fromApi));
            } catch (e) {
                console.error("getTransporters error", e);
                setError("Failed to load transporters");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ---------- FORM HANDLERS ----------

    const resetForm = () => {
        setForm({
            name: "",
            contactPerson: "",
            cellNo: "",
            email: "",
            hasTippers: false,
            hasFlatbeds: false,
            hasTautliners: false,
            tipperRateDbn: "",
            tipperRateRb: "",
            flatbedRateDbn: "",
            flatbedRateRb: "",
            comments: "",
        });
        setEditingId(null);
    };

    const handleInputChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!form.name.trim()) {
            alert("Transporter name is required");
            return;
        }

        try {
            setSaving(true);
            setError(null);

            if (editingId) {
                const updated = await updateTransporter(
                    editingId,
                    toUpdatePayload(form)
                );
                setTransporters((prev) =>
                    prev.map((t) => (t.id === editingId ? fromApi(updated) : t))
                );
            } else {
                const created = await createTransporter(toCreatePayload(form));
                setTransporters((prev) => [...prev, fromApi(created)]);
            }

            resetForm();
        } catch (e) {
            console.error("save transporter error", e);
            setError("Failed to save transporter");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (t: Transporter) => {
        setForm({
            name: t.name,
            contactPerson: t.contactPerson || "",
            cellNo: t.cellNo || "",
            email: t.email || "",
            hasTippers: t.hasTippers,
            hasFlatbeds: t.hasFlatbeds,
            hasTautliners: t.hasTautliners,
            tipperRateDbn: t.tipperRateDbn || "",
            tipperRateRb: t.tipperRateRb || "",
            flatbedRateDbn: t.flatbedRateDbn || "",
            flatbedRateRb: t.flatbedRateRb || "",
            comments: t.comments || "",
        });
        setEditingId(t.id);
    };

    const handleDelete = async (id: string) => {
        if (typeof window !== "undefined") {
            const ok = window.confirm("Delete this transporter?");
            if (!ok) return;
        }

        try {
            setSaving(true);
            setError(null);
            await deleteTransporter(id);
            setTransporters((prev) => prev.filter((t) => t.id !== id));
            if (editingId === id) resetForm();
        } catch (e) {
            console.error("deleteTransporter error", e);
            setError("Failed to delete transporter");
            alert("Failed to delete transporter — check console for details.");
        } finally {
            setSaving(false);
        }
    };

    // ---------- SEARCH / FILTER / SORT ----------

    const normalizedSearch = search.trim().toLowerCase();

    const visibleTransporters = [...transporters]
        .filter((t) => {
            if (normalizedSearch) {
                const text = (
                    (t.name || "") +
                    " " +
                    (t.contactPerson || "") +
                    " " +
                    (t.email || "")
                ).toLowerCase();
                if (!text.includes(normalizedSearch)) return false;
            }

            if (fleetFilter === "tippers" && !t.hasTippers) return false;
            if (fleetFilter === "flatbeds" && !t.hasFlatbeds) return false;
            if (fleetFilter === "tautliners" && !t.hasTautliners) return false;

            return true;
        })
        .sort((a, b) => {
            let av: string | null = null;
            let bv: string | null = null;

            switch (sortBy) {
                case "name":
                    av = a.name;
                    bv = b.name;
                    break;
                case "tipperRateDbn":
                    av = a.tipperRateDbn;
                    bv = b.tipperRateDbn;
                    break;
                case "tipperRateRb":
                    av = a.tipperRateRb;
                    bv = b.tipperRateRb;
                    break;
                case "flatbedRateDbn":
                    av = a.flatbedRateDbn;
                    bv = b.flatbedRateDbn;
                    break;
                case "flatbedRateRb":
                    av = a.flatbedRateRb;
                    bv = b.flatbedRateRb;
                    break;
            }

            const aStr = (av || "").toLowerCase();
            const bStr = (bv || "").toLowerCase();

            if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
            if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

    // ---------- RENDER HELPERS ----------

    const yesNo = (v: boolean) => (v ? "Yes" : "No");

    const buildRow = (label: string, getter: (t: Transporter) => string) => (
        <tr key={label}>
            {/* Left label column */}
            <td
                style={{
                    padding: 6,
                    borderBottom: "1px solid #ddd",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    textAlign: "left",
                }}
            >
                {label}
            </td>

            {/* One cell per transporter – CENTERED */}
            {visibleTransporters.map((t) => (
                <td
                    key={t.id + label}
                    style={{
                        padding: 6,
                        borderBottom: "1px solid #ddd",
                        whiteSpace: "nowrap",
                        textAlign: "center", // <— this is the important bit
                    }}
                >
                    {getter(t)}
                </td>
            ))}
        </tr>
    );

    const tableHeaderCell: CSSProperties = {
        padding: 6,
        borderBottom: "2px solid #ccc",
        fontWeight: 700,
        textAlign: "center",   // make sure this is "center"
        whiteSpace: "nowrap",
    };

    // ---------- RENDER ----------

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        style={{ marginBottom: 8 }}
                    >
                        ← Back
                    </button>
                )}
                <h2>Transporter Details</h2>
                {error && (
                    <div
                        style={{
                            marginTop: 8,
                            marginBottom: 8,
                            padding: 8,
                            background: "#ffe5e5",
                            border: "1px solid #ffaaaa",
                            color: "#900",
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>

            {/* FORM ------------------------------------------------- */}
            <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                        <label>
                            Transporter name*
              <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleInputChange}
                                style={{ width: "100%", padding: 4 }}
                                required
                            />
                        </label>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label>
                            Contact person
              <input
                                type="text"
                                name="contactPerson"
                                value={form.contactPerson}
                                onChange={handleInputChange}
                                style={{ width: "100%", padding: 4 }}
                            />
                        </label>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label>
                            Cell No
              <input
                                type="text"
                                name="cellNo"
                                value={form.cellNo}
                                onChange={handleInputChange}
                                style={{ width: "100%", padding: 4 }}
                            />
                        </label>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label>
                            E-mail
              <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleInputChange}
                                style={{ width: "100%", padding: 4 }}
                            />
                        </label>
                    </div>
                </div>

                <div
                    style={{
                        border: "1px solid #cce",
                        background: "#eef6ff",
                        padding: 8,
                        marginBottom: 8,
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Fleet Available
          </div>
                    <label style={{ marginRight: 16 }}>
                        <input
                            type="checkbox"
                            name="hasTippers"
                            checked={form.hasTippers}
                            onChange={handleInputChange}
                        />{" "}
            Tippers
          </label>
                    <label style={{ marginRight: 16 }}>
                        <input
                            type="checkbox"
                            name="hasFlatbeds"
                            checked={form.hasFlatbeds}
                            onChange={handleInputChange}
                        />{" "}
            Flatbeds
          </label>
                    <label>
                        <input
                            type="checkbox"
                            name="hasTautliners"
                            checked={form.hasTautliners}
                            onChange={handleInputChange}
                        />{" "}
            Tautliners
          </label>
                </div>

                <div
                    style={{
                        border: "1px solid #eed",
                        background: "#fff8e5",
                        padding: 8,
                        marginBottom: 8,
                    }}
                >
                    <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                            <label>
                                Tipper Rate DBN
                <input
                                    type="text"
                                    name="tipperRateDbn"
                                    value={form.tipperRateDbn}
                                    onChange={handleInputChange}
                                    style={{ width: "100%", padding: 4 }}
                                    placeholder="e.g. R / t"
                                />
                            </label>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>
                                Tipper Rate RB
                <input
                                    type="text"
                                    name="tipperRateRb"
                                    value={form.tipperRateRb}
                                    onChange={handleInputChange}
                                    style={{ width: "100%", padding: 4 }}
                                    placeholder="e.g. R / t"
                                />
                            </label>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>
                                Flatbed Rate DBN
                <input
                                    type="text"
                                    name="flatbedRateDbn"
                                    value={form.flatbedRateDbn}
                                    onChange={handleInputChange}
                                    style={{ width: "100%", padding: 4 }}
                                    placeholder="e.g. R / t"
                                />
                            </label>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>
                                Flatbed Rate RB
                <input
                                    type="text"
                                    name="flatbedRateRb"
                                    value={form.flatbedRateRb}
                                    onChange={handleInputChange}
                                    style={{ width: "100%", padding: 4 }}
                                    placeholder="e.g. R / t"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        border: "1px solid #ddd",
                        background: "#f7f7f7",
                        padding: 8,
                        marginBottom: 8,
                    }}
                >
                    <label style={{ display: "block" }}>
                        Comments
            <textarea
                            name="comments"
                            value={form.comments}
                            onChange={handleInputChange}
                            style={{
                                width: "100%",
                                padding: 4,
                                minHeight: 60,
                                resize: "vertical",
                            }}
                            placeholder="General notes, special conditions, etc."
                        />
                    </label>
                </div>

                <div>
                    <button type="submit" disabled={saving}>
                        {editingId ? "Update Transporter" : "Save Transporter"}
                    </button>
                    {editingId && (
                        <button
                            type="button"
                            onClick={resetForm}
                            disabled={saving}
                            style={{ marginLeft: 8 }}
                        >
                            Cancel edit
                        </button>
                    )}
                    {saving && (
                        <span style={{ marginLeft: 8 }}>Saving, please wait…</span>
                    )}
                </div>
            </form>

            {/* COMPARISON TABLE ------------------------------------- */}

            <h3 style={{ marginTop: 24 }}>Transporter Comparison</h3>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 8,
                    alignItems: "center",
                }}
            >
                <div>
                    <input
                        type="text"
                        placeholder="Search by name / contact / e-mail"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: 4, minWidth: 240 }}
                    />
                </div>

                <div>
                    <label>
                        Fleet:
            <select
                            value={fleetFilter}
                            onChange={(e) =>
                                setFleetFilter(e.target.value as typeof fleetFilter)
                            }
                            style={{ marginLeft: 4, padding: 4 }}
                        >
                            <option value="all">All</option>
                            <option value="tippers">Tippers only</option>
                            <option value="flatbeds">Flatbeds only</option>
                            <option value="tautliners">Tautliners only</option>
                        </select>
                    </label>
                </div>

                <div>
                    <label>
                        Sort by:
            <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            style={{ marginLeft: 4, padding: 4 }}
                        >
                            <option value="name">Name</option>
                            <option value="tipperRateDbn">Tipper Rate DBN</option>
                            <option value="tipperRateRb">Tipper Rate RB</option>
                            <option value="flatbedRateDbn">Flatbed Rate DBN</option>
                            <option value="flatbedRateRb">Flatbed Rate RB</option>
                        </select>
                    </label>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() =>
                            setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                        }
                        style={{ padding: "4px 8px" }}
                    >
                        {sortDir === "asc" ? "A → Z" : "Z → A"}
                    </button>
                </div>
            </div>

            <div
                style={{
                    overflowX: "auto",
                    marginTop: 8,
                    border: "1px solid #ddd",
                }}
            >
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                    <thead>
                        <tr>
                            <th style={tableHeaderCell}></th>
                            {visibleTransporters.map((t) => (
                                <th key={t.id} style={tableHeaderCell}>
                                    <div>{t.name}</div>
                                    <div style={{ marginTop: 4 }}>
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(t)}
                                            style={{ marginRight: 4 }}
                                        >
                                            Edit
                    </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(t.id)}
                                            style={{
                                                color: "white",
                                                background: "#d9534f",
                                                border: "none",
                                                padding: "2px 6px",
                                                cursor: "pointer",
                                            }}
                                        >
                                            X
                    </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {buildRow("Contact Person", (t) => t.contactPerson || "—")}
                        {buildRow("Cell No", (t) => t.cellNo || "—")}
                        {buildRow("E-mail", (t) => t.email || "—")}
                        {buildRow("Tippers", (t) => yesNo(t.hasTippers))}
                        {buildRow("Flatbeds", (t) => yesNo(t.hasFlatbeds))}
                        {buildRow("Tautliners", (t) => yesNo(t.hasTautliners))}
                        {buildRow("Tipper Rate DBN", (t) => t.tipperRateDbn || "—")}
                        {buildRow("Tipper Rate RB", (t) => t.tipperRateRb || "—")}
                        {buildRow("Flatbed Rate DBN", (t) => t.flatbedRateDbn || "—")}
                        {buildRow("Flatbed Rate RB", (t) => t.flatbedRateRb || "—")}
                        {buildRow("Comments", (t) => t.comments || "—")}
                    </tbody>
                </table>
            </div>

            {loading && (
                <div style={{ marginTop: 8 }}>Loading transporters…</div>
            )}
            {!loading && transporters.length === 0 && (
                <div style={{ marginTop: 8 }}>No transporters captured yet.</div>
            )}
            {!loading &&
                transporters.length > 0 &&
                visibleTransporters.length === 0 && (
                    <div style={{ marginTop: 8 }}>
                        No transporters match your search / filters.
                    </div>
                )}
        </div>
    );
}

export default TransporterDetails;
