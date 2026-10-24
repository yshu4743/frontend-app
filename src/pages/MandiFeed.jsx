import { useState } from "react";
import {
  MessageSquareText,
  Sparkles,
  Trash2,
  Plus,
  Calculator,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { parserAPI, pricingAPI } from "../services/api";

const SAMPLE_MESSAGE = `Tomato 28, Onion 24, Potato 18
Mango 65
Rice - 42
Chili 90`;

const CATEGORIES = ["Vegetables", "Fruits", "Grains", "Spices", "Other"];

const emptyItem = { name: "", category: "Vegetables", baseCost: "", unit: "kg" };

const inr = (value) => `₹${Number(value || 0).toFixed(2)}`;

function MandiFeed({
  parsedItems,
  setParsedItems,
  calculatedRates,
  setCalculatedRates,
}) {
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleParse = async () => {
    const text = rawText.trim();
    if (!text) {
      setError("Paste a WhatsApp mandi message first.");
      setNotice("");
      return;
    }

    setParsing(true);
    setError("");
    setNotice("");
    try {
      const res = await parserAPI.parseWhatsApp(text);
      const items = res.data?.items ?? [];
      setParsedItems(items);
      setNotice(
        items.length
          ? `Parsed ${items.length} item(s). Review them below, then calculate rates.`
          : 'No items found. Try a format like "Tomato 28, Onion 24".'
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setParsing(false);
    }
  };

  const updateItem = (index, field, value) => {
    setParsedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => setParsedItems((prev) => [...prev, { ...emptyItem }]);

  const removeItem = (index) =>
    setParsedItems((prev) => prev.filter((_, i) => i !== index));

  const clearFeed = () => {
    setRawText("");
    setError("");
    setNotice("");
  };

  const handleCalculate = async () => {
    const cleanItems = parsedItems
      .filter(
        (item) =>
          item.name?.trim() &&
          item.baseCost !== "" &&
          !Number.isNaN(Number(item.baseCost))
      )
      .map((item) => ({
        itemId: item.itemId || null,
        itemName: item.name.trim(),
        category: item.category || "Vegetables",
        unit: item.unit || "kg",
        baseCost: Number(item.baseCost),
      }));

    if (!cleanItems.length) {
      setError("Add at least one item with a name and a valid base cost.");
      setNotice("");
      return;
    }

    setCalculating(true);
    setError("");
    setNotice("");
    try {
      const res = await pricingAPI.calculate(cleanItems);
      setCalculatedRates(res.data);
      const shopCount = res.data?.items?.[0]?.shopRates?.length ?? 0;
      setNotice(
        `Calculated rates for ${res.data?.items?.length ?? 0} item(s) across ${shopCount} shop(s). Open the Master Decision Matrix to review and dispatch.`
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setCalculating(false);
    }
  };

  const shopCount = calculatedRates?.items?.[0]?.shopRates?.length ?? 0;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Raw input */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2">
            <MessageSquareText className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Mandi Feed</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Paste the raw WhatsApp message from the mandi. We will extract item
            names and base costs automatically.
          </p>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            placeholder={SAMPLE_MESSAGE}
            className="mt-4 w-full resize-y rounded-lg border border-gray-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {parsing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {parsing ? "Parsing..." : "Parse Message"}
            </button>
            <button
              type="button"
              onClick={() => setRawText(SAMPLE_MESSAGE)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Use sample
            </button>
            <button
              type="button"
              onClick={clearFeed}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Pipeline explainer */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Pricing pipeline</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              ["Parse", "Extract items and base costs from the mandi message."],
              ["Price", "Apply tier margins plus each shop's risk buffer."],
              ["Review", "Fine-tune final rates in the Master Decision Matrix."],
              ["Dispatch", "Approve and send rate snippets to the field."],
            ].map(([title, desc], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {index + 1}
                </span>
                <span>
                  <span className="font-medium text-gray-900">{title}. </span>
                  <span className="text-gray-500">{desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Parsed items */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Parsed Items</h2>
            <p className="text-sm text-gray-500">
              {parsedItems.length} item(s) ready for pricing
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Plus size={16} /> Add row
            </button>
            <button
              type="button"
              onClick={handleCalculate}
              disabled={calculating || !parsedItems.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {calculating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Calculator size={16} />
              )}
              {calculating ? "Calculating..." : "Calculate Rates"}
            </button>
          </div>
        </div>

        {parsedItems.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            No items yet. Parse a WhatsApp message or add a row manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Item name</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Base cost (₹/unit)</th>
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <input
                        value={item.name ?? ""}
                        onChange={(e) =>
                          updateItem(index, "name", e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={item.category ?? "Vegetables"}
                        onChange={(e) =>
                          updateItem(index, "category", e.target.value)
                        }
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.baseCost ?? ""}
                        onChange={(e) =>
                          updateItem(index, "baseCost", e.target.value)
                        }
                        className="w-32 rounded-md border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={item.unit ?? "kg"}
                        onChange={(e) =>
                          updateItem(index, "unit", e.target.value)
                        }
                        className="w-20 rounded-md border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-500 transition-colors hover:text-red-700"
                        aria-label={`Remove ${item.name || "item"}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Calculated summary */}
      {calculatedRates?.items?.length ? (
        <section className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 size={20} />
            <h2 className="font-semibold">Rates calculated</h2>
          </div>
          <p className="mt-1 text-sm text-green-700">
            {calculatedRates.items.length} item(s) priced across {shopCount}{" "}
            shop(s). Cheapest base cost is{" "}
            {inr(
              Math.min(...calculatedRates.items.map((i) => Number(i.baseCost)))
            )}
            . Switch to the Master Decision Matrix tab to review and dispatch.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default MandiFeed;
