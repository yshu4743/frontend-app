import { useState } from "react";
import { LayoutDashboard, MessageSquareText, Settings, Calculator, Send } from "lucide-react";
import MandiFeed from "./pages/MandiFeed";
import EngineRules from "./pages/EngineRules";
import MasterDecisionMatrix from "./pages/MasterDecisionMatrix";
import FieldDispatch from "./pages/FieldDispatch";

function App() {
  const [activeTab, setActiveTab] = useState(1);
  const [calculatedRates, setCalculatedRates] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [rateSheet, setRateSheet] = useState(null);

  const tabs = [
    { id: 1, name: "Mandi Feed & Parser", icon: MessageSquareText },
    { id: 2, name: "Engine Rules & Shop Tiers", icon: Settings },
    { id: 3, name: "Master Decision Matrix", icon: Calculator },
    { id: 4, name: "Field Dispatch Center", icon: Send },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Dynamic Multi-Shop Wholesale & Pricing Engine
              </h1>
              <p className="text-sm text-gray-500">
                Rate Updater - Complete Full-Stack Solution
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 1 && (
          <MandiFeed
            parsedItems={parsedItems}
            setParsedItems={setParsedItems}
            calculatedRates={calculatedRates}
            setCalculatedRates={setCalculatedRates}
          />
        )}
        {activeTab === 2 && <EngineRules />}
        {activeTab === 3 && (
          <MasterDecisionMatrix
            calculatedRates={calculatedRates}
            setCalculatedRates={setCalculatedRates}
            setRateSheet={setRateSheet}
          />
        )}
        {activeTab === 4 && <FieldDispatch rateSheet={rateSheet} />}
      </main>
    </div>
  );
}

export default App;
