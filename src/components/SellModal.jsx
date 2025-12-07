import { motion } from "framer-motion"
import { X, Upload, FileCode, Check } from "lucide-react" // Added icons
import AddressDisplay from "./AddressDisplay"
import { useState } from "react"

export default function SellModal({
  onClose,
  onSubmit,
  submitting,
  lastProtectedAddress,
  defaultAuthorizedApp,
  grantStatus,
  grantResult,
  grantError,
  grantInProgress,
  onRetryGrant,
  grantPriceNrlc,
  grantPriceRlcDisplay,
  grantVolume,
}) {
  const [fileName, setFileName] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) setFileName(file.name)
  }

  return (
    <motion.div
      className="modal-sell"
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h3 className="modal-title">Sell DeFi Strategy</h3>
        <button className="modal-close-button" onClick={onClose}>
          <X size={20} style={{ color: "#94a3b8" }} />
        </button>
      </div>
      <p className="modal-description">
        Upload your Python logic. It will be encrypted and executed securely in a TEE.
        Buyers only see the transaction output, never your code.
      </p>

      <form className="modal-form" onSubmit={onSubmit}>
        <div className="form-group">
          <label className="form-label">Strategy Title</label>
          <input name="title" required placeholder="e.g., Aave/Compound Yield Optimizer" className="form-input" />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Asset</label>
            <select name="asset" className="form-select">
              <option value="USDC">USDC</option>
              <option value="ETH">ETH</option>
              <option value="WBTC">WBTC</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Price per Run (RLC)</label>
            <input name="priceEth" type="number" step="0.001" defaultValue={2} className="form-input" />
          </div>
        </div>

        {/* NEW: File Upload Section */}
        <div className="form-group">
          <label className="form-label">Strategy Code (.py)</label>
          <div className="file-upload-wrapper" style={{
            border: "2px dashed #cbd5e1",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
            cursor: "pointer",
            background: "#f8fafc",
            position: "relative"
          }}>
            <input
              type="file"
              name="strategyFile"
              accept=".py"
              required
              onChange={handleFileChange}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer"
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              {fileName ? (
                <>
                  <FileCode size={32} color="#0ea5e9" />
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{fileName}</span>
                </>
              ) : (
                <>
                  <Upload size={24} color="#64748b" />
                  <span style={{ color: "#64748b" }}>Click to upload logic.py</span>
                </>
              )}
            </div>
          </div>
          <p className="form-steps-note">
            Your script must implement a <code>generate_calldata</code> function.
          </p>
        </div>

        {/* Existing Footer Actions */}
        <div className="form-actions">
          <button type="button" className="glass-button" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            disabled={submitting || !!lastProtectedAddress}
            className="gradient-button"
            style={{
              opacity: submitting || !!lastProtectedAddress ? 0.6 : 1,
              cursor: submitting || !!lastProtectedAddress ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Protecting & Publishing..." : lastProtectedAddress ? "Strategy Listed" : "Publish Strategy"}
          </button>
        </div>

        {/* Existing Grant Status Display (Kept same as before) */}
        {lastProtectedAddress && (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            {/* 1. Protection Success Header */}
            <div className="p-4 border-b border-zinc-100 bg-zinc-50">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="font-bold text-zinc-700 text-sm">Step 1: Data Protected</span>
              </div>
              <div className="text-xs text-zinc-500 flex items-center gap-2">
                <AddressDisplay address={lastProtectedAddress} />
              </div>
            </div>

            {/* 2. Grant Access Status Section */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                {grantResult ? (
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                ) : grantError ? (
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
                )}
                <span className="font-bold text-zinc-700 text-sm">
                  Step 2: Granting Access to iApp
                </span>
              </div>

              {/* Dynamic Status Message */}
              <div className="text-sm text-zinc-600 mb-4 pl-4 border-l-2 border-zinc-200">
                {grantStatus || (grantInProgress ? "Initializing grant..." : "Waiting...")}
              </div>

              {/* SUCCESS STATE: This is the new part you wanted */}
              {grantResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-green-50 border border-green-200 p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
                    <Check size={18} />
                    <span>Success! Strategy is Live.</span>
                  </div>
                  <p className="text-green-700 text-xs leading-relaxed">
                    Your strategy is now protected and authorized for the generic runner.
                    Users can now find it in the marketplace and purchase executions.
                  </p>
                  <div className="mt-2 text-xs text-green-800 font-mono bg-green-100/50 p-2 rounded">
                    Price: {grantResult.datasetprice} nRLC • Volume: {grantResult.volume}
                  </div>
                </motion.div>
              )}

              {/* ERROR STATE */}
              {grantError && !grantInProgress && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <div className="text-red-800 font-bold text-sm mb-1">Grant Failed</div>
                  <div className="text-red-700 text-xs">{grantError}</div>
                  <button
                    type="button"
                    onClick={onRetryGrant}
                    className="mt-3 text-xs bg-red-100 hover:bg-red-200 text-red-800 py-1.5 px-3 rounded-lg font-medium transition-colors"
                  >
                    Retry Grant
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </motion.div>
  )
}