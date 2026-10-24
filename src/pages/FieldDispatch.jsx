import { useEffect, useState } from "react";
import {
  Send,
  Copy,
  Check,
  MessageCircle,
  Truck,
  AlertCircle,
  History,
  Loader2,
} from "lucide-react";
import { rateSheetAPI } from "../services/api";

const buildSnippets = (sheet) => {
  const snippets = {};
  if (!sheet?.items?.length) return snippets;

  const routes = new Set();
  sheet.items.forEach((item) => {
    item.shopRates?.forEach((rate) => {
      routes.add((rate.shopName || "").split(" ")[0] || "General");
    });
  });

  routes.forEach((route) => {
    let snippet = `*RATE UPDATE - ${new Date(sheet.date).toLocaleDateString()}*\n`;
    snippet += `Route: ${route}\n-------------------\n\n`;

    sheet.items.forEach((item) => {
      const relevant =
        item.shopRates?.filter((rate) =>
          rate.shopName?.toLowerCase().includes(route.toLowerCase())
        ) ?? [];

      if (relevant.length) {
        snippet += `*${item.itemName.toUpperCase()} (${item.baseCost}/kg base)*\n`;
        relevant.forEach((rate) => {
          snippet += `  ${rate.shopName}: ₹${rate.finalRate}/kg\n`;
        });
        snippet += "\n";
      }
    });

    snippet += "-------------------\n*Approved & Dispatched*";
    snippets[route] = snippet;
  });

  return snippets;
};

function FieldDispatch({ rateSheet }) {
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (rateSheet) setSelected(rateSheet);
  }, [rateSheet]);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await rateSheetAPI.getAll();
        if (active) setHistory(res.data?.rateSheets ?? []);
      } catch (err) {
        if (active) setError(err.response?.data?.message || err.message);
      } finally {
        if (active) setLoadingHistory(false);
      }
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, [rateSheet]);

  const sheet = selected?.rateSheet || selected;
  const snippets = selected?.dispatchSnippets || (sheet ? buildSnippets(sheet) : {});
  const routeKeys = Object.keys(snippets);

  const handleCopy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? "" : current)), 2000);
    } catch {
      setError("Could not copy to clipboard. Select the text and copy manually.");
    }
  };

  if (!sheet && !history.length && !loadingHistory) {
    return (
      <section className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <Send className="mx-auto text-gray-300" size={40} />
        <h2 className="mt-3 text-lg font-semibold text-gray-900">
          Nothing dispatched yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          Approve a rate sheet in the Master Decision Matrix tab. Once
          dispatched, the driver snippets will appear here ready to share.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Truck className="text-blue-600" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Field Dispatch Center
              </h2>
              <p className="text-sm text-gray-500">
                Copy a route snippet and send it to the driver group.
              </p>
            </div>
          </div>
          {history.length ? (
            <div className="flex items-center gap-2">
              <History size={16} className="text-gray-400" />
              <select
                value={selected && sheet?._id === selected.rateSheet?._id ? "current" : sheet?._id || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "current") {
                    setSelected(rateSheet);
                    return;
                  }
                  const found = history.find((s) => s._id === value);
                  setSelected(found || null);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {sheet ? <option value="current">Current dispatch</option> : null}
                {history.map((s) => (
                  <option key={s._id} value={s._id}>
                    {new Date(s.date).toLocaleDateString()} · {s.status}
                  </option>
                ))}
              </select>
            </div>
          ) : loadingHistory ? (
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading history...
            </span>
          ) : null}
        </div>

        {sheet ? (
          <>
            <div className="grid gap-3 border-b border-gray-200 px-5 py-4 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">
                  Date
                </div>
                <div className="font-medium text-gray-900">
                  {new Date(sheet.date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">
                  Status
                </div>
                <div className="font-medium text-green-700">{sheet.status}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">
                  Routes
                </div>
                <div className="font-medium text-gray-900">
                  {routeKeys.length}
                </div>
              </div>
            </div>

            {routeKeys.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-500">
                No route snippets available for this rate sheet.
              </p>
            ) : (
              <div className="grid gap-4 p-5 lg:grid-cols-2">
                {routeKeys.map((route) => {
                  const text = snippets[route];
                  return (
                    <div
                      key={route}
                      className="flex flex-col rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                        <span className="font-medium text-gray-900">
                          Route: {route}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(route, text)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            {copied === route ? (
                              <Check size={14} className="text-green-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                            {copied === route ? "Copied" : "Copy"}
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
                          >
                            <MessageCircle size={14} /> WhatsApp
                          </a>
                        </div>
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-gray-800">
                        {text}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            Select a dispatched rate sheet from the history above.
          </p>
        )}
      </section>
    </div>
  );
}

export default FieldDispatch;
