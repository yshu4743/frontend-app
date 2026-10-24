import { useMemo, useState } from "react";
import {
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
} from "lucide-react";
import { shopAPI } from "../services/api";

const TIER_MARGIN = { "Tier 1": 10, "Tier 2": 15, "Tier 3": 20 };
const TIERS = Object.keys(TIER_MARGIN);

const MAPPABLE_FIELDS = [
  { field: "name", label: "Shop / party name" },
  { field: "phone", label: "Phone" },
  { field: "balance", label: "Ledger balance" },
  { field: "purchase", label: "Purchase / sales" },
  { field: "route", label: "Route / area" },
];

// Column header aliases used across Vyapar, Khatabook, Marg and similar apps.
const FIELD_ALIASES = {
  name: [
    "name",
    "partyname",
    "party",
    "shopname",
    "shop",
    "customername",
    "customer",
    "firmname",
    "firm",
    "accountname",
    "ledgername",
    "particulars",
    "businessname",
    "companyname",
  ],
  phone: [
    "phone",
    "phonenumber",
    "phoneno",
    "mobile",
    "mobileno",
    "mobilenumber",
    "contact",
    "contactnumber",
    "whatsapp",
  ],
  balance: [
    "balance",
    "closingbalance",
    "ledgerbalance",
    "outstanding",
    "dueamount",
    "netbalance",
    "balanceamount",
    "receivable",
    "pendingamount",
    "osamount",
  ],
  purchase: [
    "purchase",
    "purchases",
    "totalpurchase",
    "purchaseamount",
    "totalsales",
    "sales",
    "salesamount",
    "totalamount",
    "netamount",
    "totalbill",
    "billamount",
    "turnover",
    "business",
    "totalbusiness",
    "amount",
  ],
  route: [
    "route",
    "routegroup",
    "area",
    "beat",
    "location",
    "region",
    "city",
    "zone",
    "territory",
  ],
};

const SAMPLE_CSV = `Party Name,Phone Number,Balance,Total Sales,Route
Verma Vegetables,9876543210,12500,480000,North Route
Gupta Traders,9876500000,3200,92000,North Route
Sharma Kirana,9876511111,0,18000,South Route
Balaji Stores,9876522222,45000,15000,East Route`;

const inr = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const detectDelimiter = (line) => {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = line.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
};

const parseDelimited = (text, delimiter) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
};

const toNumber = (value) => {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const guessMapping = (headers) => {
  const normalized = headers.map(normalize);
  const used = new Set();
  const mapping = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    let index = -1;

    for (const alias of aliases) {
      const found = normalized.findIndex(
        (header, i) => header === alias && !used.has(i)
      );
      if (found !== -1) {
        index = found;
        break;
      }
    }

    if (index === -1) {
      for (const alias of aliases) {
        const found = normalized.findIndex(
          (header, i) =>
            header && !used.has(i) && (header.includes(alias) || alias.includes(header))
        );
        if (found !== -1) {
          index = found;
          break;
        }
      }
    }

    mapping[field] = index;
    if (index >= 0) used.add(index);
  }

  return mapping;
};

const analyzeTier = (purchase, tier1Min, tier2Min) => {
  if (purchase >= tier1Min) return "Tier 1";
  if (purchase >= tier2Min) return "Tier 2";
  return "Tier 3";
};

function ShopDataImport({ onImported }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [tier1Min, setTier1Min] = useState(100000);
  const [tier2Min, setTier2Min] = useState(25000);
  const [tierOverrides, setTierOverrides] = useState({});
  const [excluded, setExcluded] = useState(() => new Set());
  const [pasted, setPasted] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);

  const resetRows = () => {
    setTierOverrides({});
    setExcluded(new Set());
    setResult(null);
  };

  const processText = (text, name = "") => {
    setError("");
    setNotice("");
    setResult(null);
    setTierOverrides({});
    setExcluded(new Set());

    const clean = String(text).replace(/^\uFEFF/, "");
    const firstLine =
      clean.split(/\r?\n/).find((line) => line.trim() !== "") || "";

    if (!firstLine) {
      setError("The file appears to be empty.");
      return;
    }

    const delimiter = detectDelimiter(firstLine);
    const table = parseDelimited(clean, delimiter);

    if (table.length < 2) {
      setError("Could not find a header row and at least one data row.");
      setHeaders([]);
      setRawRows([]);
      return;
    }

    const nextHeaders = table[0].map((header) => String(header).trim());
    setHeaders(nextHeaders);
    setRawRows(table.slice(1));
    setMapping(guessMapping(nextHeaders));
    setFileName(name);
  };

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      processText(text, file.name);
    } catch (err) {
      setError(err.message || "Could not read the file.");
    }
  };

  const rows = useMemo(() => {
    const get = (row, field) => {
      const index = mapping[field];
      return index != null && index >= 0 ? row[index] : undefined;
    };

    return rawRows.map((row, index) => {
      const name = String(get(row, "name") ?? "").trim();
      const phone = String(get(row, "phone") ?? "").trim();
      const purchaseRaw = get(row, "purchase");
      const purchase = toNumber(purchaseRaw);
      const hasPurchase =
        mapping.purchase >= 0 && String(purchaseRaw ?? "").trim() !== "";
      const autoTier = hasPurchase
        ? analyzeTier(purchase, tier1Min, tier2Min)
        : "Tier 2";

      return {
        index,
        name,
        phone,
        ledgerBalance: toNumber(get(row, "balance")),
        purchase,
        hasPurchase,
        autoTier,
        tier: tierOverrides[index] || autoTier,
        routeGroup: String(get(row, "route") ?? "").trim(),
        include: Boolean(name) && !excluded.has(index),
      };
    });
  }, [rawRows, mapping, tier1Min, tier2Min, tierOverrides, excluded]);

  const selectedRows = rows.filter((row) => row.include);
  const tierCounts = selectedRows.reduce((acc, row) => {
    acc[row.tier] = (acc[row.tier] || 0) + 1;
    return acc;
  }, {});
  const totalPurchase = selectedRows.reduce((sum, row) => sum + row.purchase, 0);
  const totalBalance = selectedRows.reduce(
    (sum, row) => sum + row.ledgerBalance,
    0
  );

  const toggleExclude = (index) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const setTier = (index, tier) =>
    setTierOverrides((prev) => ({ ...prev, [index]: tier }));

  const handleImport = async () => {
    if (!selectedRows.length) {
      setError("No shops selected for import.");
      return;
    }

    setImporting(true);
    setError("");
    setNotice("");
    try {
      const res = await shopAPI.importShops(
        selectedRows.map((row) => ({
          name: row.name,
          phone: row.phone,
          ledgerBalance: row.ledgerBalance,
          tier: row.tier,
          marginPercent: TIER_MARGIN[row.tier] ?? 15,
          riskBuffer: 0,
          routeGroup: row.routeGroup || "Unassigned",
        }))
      );
      setResult(res.data);
      setNotice(
        `Imported ${res.data.count} shop(s): ${res.data.created} created, ${res.data.updated} updated.`
      );
      if (onImported) onImported();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setImporting(false);
    }
  };

  const clearAll = () => {
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setPasted("");
    setError("");
    setNotice("");
    resetRows();
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample-shop-data.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <Database className="text-blue-600" size={20} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Import Wholesale Data
            </h2>
            <p className="text-sm text-gray-500">
              Upload a CSV export from Vyapar or another billing app. Ledger
              balances are imported and each shop&apos;s tier is analysed from
              its purchase volume.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadSample}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Download size={16} /> Sample CSV
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-start gap-2 border-b border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="grid gap-5 p-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
          >
            <Upload className="text-gray-400" size={28} />
            <span className="mt-2 text-sm font-medium text-gray-700">
              Drop a CSV file here or click to browse
            </span>
            <span className="mt-1 text-xs text-gray-500">
              Exports from Vyapar, Khatabook, Marg and similar apps (save as
              CSV)
            </span>
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>

          {fileName ? (
            <p className="mt-2 text-xs text-gray-500">
              Loaded <span className="font-medium">{fileName}</span> ·{" "}
              {rawRows.length} row(s)
            </p>
          ) : null}

          <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Paste data manually
            </summary>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              placeholder={SAMPLE_CSV}
              className="mt-3 w-full resize-y rounded-md border border-gray-300 p-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => processText(pasted, "pasted-data.csv")}
              disabled={!pasted.trim()}
              className="mt-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              Parse pasted text
            </button>
          </details>
        </div>

        <div className="space-y-3">
          <Field label="Tier 1 when purchase ≥ (₹)">
            <input
              type="number"
              min="0"
              value={tier1Min}
              onChange={(e) => setTier1Min(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Tier 2 when purchase ≥ (₹)">
            <input
              type="number"
              min="0"
              value={tier2Min}
              onChange={(e) => setTier2Min(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <button
            type="button"
            onClick={() => processText(SAMPLE_CSV, "sample-shop-data.csv")}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Load sample data
          </button>
          {headers.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Clear
            </button>
          ) : null}
          <p className="text-xs text-gray-500">
            Shops at or above the Tier 1 threshold get the low-margin tier;
            lower purchase volumes fall to Tier 2 or Tier 3.
          </p>
        </div>
      </div>

      {headers.length > 0 ? (
        <>
          <div className="border-t border-gray-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Column mapping
            </h3>
            <p className="text-xs text-gray-500">
              We auto-detected these columns. Adjust any that were guessed
              wrong.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {MAPPABLE_FIELDS.map(({ field, label }) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    {label}
                  </span>
                  <select
                    value={mapping[field] ?? -1}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field]: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value={-1}>— none —</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Column ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-200 px-5 py-3 text-xs">
            <Chip>
              Selected {selectedRows.length}/{rows.length}
            </Chip>
            <Chip>Tier 1 · {tierCounts["Tier 1"] || 0}</Chip>
            <Chip>Tier 2 · {tierCounts["Tier 2"] || 0}</Chip>
            <Chip>Tier 3 · {tierCounts["Tier 3"] || 0}</Chip>
            <Chip>Purchase {inr(totalPurchase)}</Chip>
            <Chip>Ledger {inr(totalBalance)}</Chip>
          </div>

          <div className="max-h-96 overflow-auto border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Include</th>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Ledger balance</th>
                  <th className="px-4 py-3">Purchase</th>
                  <th className="px-4 py-3">Analysed tier</th>
                  <th className="px-4 py-3">Tier (override)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr
                    key={row.index}
                    className={row.include ? "hover:bg-gray-50" : "opacity-50"}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={() => toggleExclude(row.index)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.name || (
                        <span className="text-red-500">missing name</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.phone || "—"}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        row.ledgerBalance > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {inr(row.ledgerBalance)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.hasPurchase ? (
                        inr(row.purchase)
                      ) : (
                        <span className="text-xs text-gray-400">n/a</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasPurchase ? (
                        <TierBadge tier={row.autoTier} />
                      ) : (
                        <span className="text-xs text-gray-400">
                          no purchase data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.tier}
                        onChange={(e) => setTier(row.index, e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        {TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-4">
            <span className="text-sm text-gray-500">
              {selectedRows.length} shop(s) ready to import
              {result
                ? ` · last import: ${result.created} new, ${result.updated} updated`
                : ""}
            </span>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !selectedRows.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Database size={16} />
              )}
              {importing ? "Importing..." : "Import to Engine"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function Chip({ children }) {
  return (
    <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
      {children}
    </span>
  );
}

function TierBadge({ tier }) {
  const styles = {
    "Tier 1": "bg-blue-100 text-blue-700",
    "Tier 2": "bg-indigo-100 text-indigo-700",
    "Tier 3": "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[tier] || "bg-gray-100 text-gray-700"
      }`}
    >
      {tier}
    </span>
  );
}

export default ShopDataImport;
