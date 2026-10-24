import { useState } from "react";
import {
  Calculator,
  Send,
  AlertTriangle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { pricingAPI, rateSheetAPI } from "../services/api";
import ShopDataImport from "../components/ShopDataImport";

const inr = (value) => `₹${Number(value || 0).toFixed(2)}`;

const SAFE_MARGIN = 5;

function MasterDecisionMatrix({
  calculatedRates,
  setCalculatedRates,
  setRateSheet,
}) {
  const [view, setView] = useState("rate");
  const [calculating, setCalculating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const items = calculatedRates?.items ?? [];
  const shops = items[0]?.shopRates ?? [];
  const squeezedCount = items.reduce(
    (total, item) =>
      total + (item.shopRates?.filter((rate) => rate.isSqueezed).length ?? 0),
    0
  );

  const updateFinalRate = (itemIndex, shopIndex, value) => {
    setCalculatedRates((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.map((item, i) => {
        if (i !== itemIndex) return item;
        const shopRates = item.shopRates.map((rate, j) => {
          if (j !== shopIndex) return rate;
          const finalRate = Number(value);
          if (Number.isNaN(finalRate)) return rate;
          const marginEarned = parseFloat((finalRate - item.baseCost).toFixed(2));
          const percent = item.baseCost
            ? (marginEarned / item.baseCost) * 100
            : 0;
          return {
            ...rate,
            finalRate,
            marginEarned,
            isSqueezed: percent < SAFE_MARGIN,
          };
        });
        return { ...item, shopRates };
      });
      return { ...prev, items: nextItems };
    });
  };

  const handleRecalculate = async () => {
    if (!items.length) return;
    setCalculating(true);
    setError("");
    setNotice("");
    try {
      const res = await pricingAPI.calculate(
        items.map((item) => ({
          itemId: item.itemId || null,
          itemName: item.itemName,
          baseCost: Number(item.baseCost),
        }))
      );
      setCalculatedRates(res.data);
      setNotice("Rates recalculated from the current base costs and shops.");
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleDispatch = async () => {
    if (!items.length) return;
    setDispatching(true);
    setError("");
    setNotice("");
    try {
      const res = await rateSheetAPI.dispatch({
        items,
        date: calculatedRates?.date || new Date(),
      });
      setRateSheet(res.data);
      setNotice(
        "Rate sheet approved and dispatched. Open the Field Dispatch Center to share the snippets."
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setDispatching(false);
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

      <ShopDataImport onImported={handleRecalculate} />

      {!items.length ? (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
          <Calculator className="mx-auto text-gray-300" size={40} />
          <h2 className="mt-3 text-lg font-semibold text-gray-900">
            No rates calculated yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Import your shops above, then go to the Mandi Feed tab, parse a
            message, and click{" "}
            <span className="font-medium text-gray-700">Calculate Rates</span>.
            The decision matrix will appear here.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Calculator className="text-blue-600" size={20} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Master Decision Matrix
                </h2>
                <p className="text-sm text-gray-500">
                  {items.length} item(s) × {shops.length} shop(s). Edit a final
                  rate to see the margin update instantly.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-gray-300">
                <button
                  type="button"
                  onClick={() => setView("rate")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    view === "rate"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Final rate
                </button>
                <button
                  type="button"
                  onClick={() => setView("margin")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    view === "margin"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Margin
                </button>
              </div>

              <button
                type="button"
                onClick={handleRecalculate}
                disabled={calculating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {calculating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Recalculate
              </button>

              <button
                type="button"
                onClick={handleDispatch}
                disabled={dispatching}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {dispatching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {dispatching ? "Dispatching..." : "Approve & Dispatch"}
              </button>
            </div>
          </div>

          {squeezedCount > 0 ? (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700">
              <AlertTriangle size={18} />
              {squeezedCount} rate(s) fall below the {SAFE_MARGIN}% safe margin
              threshold. Adjust the final rate before dispatching.
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-5 py-3">
                    Item / Base
                  </th>
                  {shops.map((shop) => (
                    <th key={shop.shopId} className="px-5 py-3">
                      {shop.shopName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, itemIndex) => (
                  <tr
                    key={`${item.itemName}-${itemIndex}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="sticky left-0 z-10 bg-white px-5 py-3">
                      <div className="font-medium text-gray-900">
                        {item.itemName}
                      </div>
                      <div className="text-xs text-gray-400">
                        base {inr(item.baseCost)}
                      </div>
                    </td>
                    {item.shopRates.map((rate, shopIndex) => (
                      <td
                        key={rate.shopId}
                        className={`px-5 py-3 ${
                          rate.isSqueezed ? "bg-red-50" : ""
                        }`}
                      >
                        {view === "rate" ? (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={rate.finalRate}
                              onChange={(e) =>
                                updateFinalRate(
                                  itemIndex,
                                  shopIndex,
                                  e.target.value
                                )
                              }
                              className={`w-20 rounded-md border px-2 py-1 focus:outline-none ${
                                rate.isSqueezed
                                  ? "border-red-300 text-red-700"
                                  : "border-gray-300"
                              }`}
                            />
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900">
                            {inr(rate.marginEarned)}
                          </span>
                        )}
                        <div
                          className={`mt-1 text-xs ${
                            rate.isSqueezed ? "text-red-600" : "text-gray-400"
                          }`}
                        >
                          margin {inr(rate.marginEarned)}
                          {rate.isSqueezed ? " · squeezed" : ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default MasterDecisionMatrix;
