import { useEffect, useState } from "react";
import {
  Settings,
  Percent,
  ShieldAlert,
  Store,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  IndianRupee,
} from "lucide-react";
import { shopAPI } from "../services/api";

const TIERS = [
  {
    tier: "Tier 1",
    margin: 10,
    desc: "High volume, low margin buyers.",
  },
  {
    tier: "Tier 2",
    margin: 15,
    desc: "Standard wholesale accounts.",
  },
  {
    tier: "Tier 3",
    margin: 20,
    desc: "High risk / credit accounts.",
  },
];

const defaultForm = {
  name: "",
  tier: "Tier 2",
  marginPercent: 15,
  riskBuffer: 0,
  ledgerBalance: 0,
  phone: "",
  routeGroup: "",
};

const inr = (value) => `₹${Number(value || 0).toFixed(2)}`;

function EngineRules() {
  const [shops, setShops] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadShops = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await shopAPI.getAllShops();
      setShops(res.data?.shops ?? []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  const updateForm = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleTierChange = (tier) => {
    const match = TIERS.find((t) => t.tier === tier);
    setForm((prev) => ({
      ...prev,
      tier,
      marginPercent: match ? match.margin : prev.marginPercent,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.routeGroup.trim()) {
      setError("Shop name and route group are required.");
      setNotice("");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      await shopAPI.createShop({
        name: form.name.trim(),
        tier: form.tier,
        marginPercent: Number(form.marginPercent) || 0,
        riskBuffer: Number(form.riskBuffer) || 0,
        ledgerBalance: Number(form.ledgerBalance) || 0,
        phone: form.phone.trim(),
        routeGroup: form.routeGroup.trim(),
      });
      setNotice(`Added "${form.name.trim()}" to the engine.`);
      setForm(defaultForm);
      await loadShops();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Engine rules */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Settings className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">
            Engine Rules &amp; Shop Tiers
          </h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Base cost plus tier margin plus the shop&apos;s risk buffer. Final
          rates are rounded to the nearest 0.5 and flagged as squeezed when the
          net margin falls below 5%.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.tier}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">{t.tier}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                  <Percent size={12} /> {t.margin}%
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{t.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">
            <ShieldAlert size={16} /> Safe margin floor: 5%
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700">
            <IndianRupee size={16} /> Risk buffer added per unit
          </span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shop list */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Store className="text-blue-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">
                Registered Shops
              </h2>
            </div>
            <span className="text-sm text-gray-500">{shops.length} total</span>
          </div>

          {loading ? (
            <p className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading shops...
            </p>
          ) : shops.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              No shops yet. Add the first shop using the form.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Shop</th>
                    <th className="px-5 py-3">Tier</th>
                    <th className="px-5 py-3">Margin</th>
                    <th className="px-5 py-3">Risk buffer</th>
                    <th className="px-5 py-3">Ledger</th>
                    <th className="px-5 py-3">Route</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shops.map((shop) => (
                    <tr key={shop._id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">
                          {shop.name}
                        </div>
                        {shop.phone ? (
                          <div className="text-xs text-gray-400">
                            {shop.phone}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {shop.tier}
                        </span>
                      </td>
                      <td className="px-5 py-3">{shop.marginPercent}%</td>
                      <td className="px-5 py-3">{inr(shop.riskBuffer)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            Number(shop.ledgerBalance) > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >
                          {inr(shop.ledgerBalance)}
                        </span>
                      </td>
                      <td className="px-5 py-3">{shop.routeGroup}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Add shop */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Plus className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Add Shop</h2>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <Field label="Shop name">
              <input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Verma Vegetables"
              />
            </Field>

            <Field label="Tier">
              <select
                value={form.tier}
                onChange={(e) => handleTierChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {TIERS.map((t) => (
                  <option key={t.tier} value={t.tier}>
                    {t.tier}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Margin %">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.marginPercent}
                  onChange={(e) => updateForm("marginPercent", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>
              <Field label="Risk buffer (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.riskBuffer}
                  onChange={(e) => updateForm("riskBuffer", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </Field>
            </div>

            <Field label="Ledger balance (₹)">
              <input
                type="number"
                step="0.01"
                value={form.ledgerBalance}
                onChange={(e) => updateForm("ledgerBalance", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </Field>

            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="e.g. 9876543210"
              />
            </Field>

            <Field label="Route group">
              <input
                value={form.routeGroup}
                onChange={(e) => updateForm("routeGroup", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="e.g. North Route"
              />
            </Field>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {saving ? "Saving..." : "Add shop"}
            </button>
          </form>
        </section>
      </div>
    </div>
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

export default EngineRules;
