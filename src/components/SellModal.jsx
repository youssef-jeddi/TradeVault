import { motion } from "framer-motion"
import { X } from "lucide-react"
import AddressDisplay from "./AddressDisplay"

export default function SellModal({
  onClose,
  onSubmit,
  numSteps,
  onNumStepsChange,
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
  const handleStepsChange = (value) => {
    const next = Math.max(1, Math.min(10, Number(value)))
    onNumStepsChange(next)
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
        <h3 className="modal-title">List your strategy</h3>
        <button className="modal-close-button" onClick={onClose}>
          <X size={20} style={{ color: "#94a3b8" }} />
        </button>
      </div>
      <p className="modal-description">
        Describe your strategy. Encryption is handled by iExec DataProtector.
      </p>
      <form className="modal-form" onSubmit={onSubmit}>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input name="title" required placeholder="e.g., BTC Momentum V3" className="form-input" />
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Asset</label>
            <select name="asset" className="form-select">
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Price (RLC)</label>
            <input name="priceEth" type="number" step="0.001" defaultValue={0.02} className="form-input" />
          </div>
        </div>

        <div className="form-steps-grid">
          <div className="form-group">
            <label className="form-label">Number of Steps</label>
            <input
              type="number"
              min={1}
              max={10}
              value={numSteps}
              onChange={(e) => handleStepsChange(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Strategy Steps (confidential - will be encrypted)</label>
            <div className="form-steps">
              {Array.from({ length: numSteps }).map((_, i) => (
                <div key={i}>
                  <input name={`step_${i + 1}`} placeholder={`Step ${i + 1}`} className="form-input" />
                </div>
              ))}
            </div>
            <p className="form-steps-note">
              These steps will be encrypted and sent to the backend. They won't be displayed in the marketplace.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="glass-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !!lastProtectedAddress}
            className="gradient-button"
            style={{
              opacity: submitting || !!lastProtectedAddress ? 0.6 : 1,
              cursor: submitting || !!lastProtectedAddress ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Publishing..." : lastProtectedAddress ? "Protected" : "Publish offer"}
          </button>
        </div>

        {lastProtectedAddress && (
          <div className="success-message">
            Protected on iExec: <AddressDisplay address={lastProtectedAddress} />
          </div>
        )}

        {lastProtectedAddress && (
          <div className="mt-6 rounded-2xl border border-zinc-200 p-4 bg-white">
            <h4 className="form-label" style={{ fontSize: 15, fontWeight: 700 }}>
              Access permissions
            </h4>
            <p className="text-sm text-zinc-600" style={{ marginTop: 6 }}>
              Granting happens automatically so your trusted iApp can consume the protected data without extra steps.
            </p>
            <div className="mt-3 space-y-3 text-sm text-zinc-600">
              <div>
                <span className="font-semibold text-zinc-800">Protected data</span>{" "}
                <AddressDisplay address={lastProtectedAddress} />
              </div>
              <div>
                <span className="font-semibold text-zinc-800">Authorized iApp</span>{" "}
                <AddressDisplay address={defaultAuthorizedApp} />
              </div>
              <div>
                <span className="font-semibold text-zinc-800">Price / Volume</span>{" "}
                {grantPriceRlcDisplay} RLC ({grantPriceNrlc} nRLC) • {grantVolume}{" "}
                {grantVolume === 1 ? "access" : "accesses"}
              </div>
              <div className="font-semibold text-zinc-800">
                Status:{" "}
                <span className="font-normal text-zinc-600">
                  {grantStatus ||
                    (grantInProgress
                      ? "Grant in progress…"
                      : grantResult
                      ? "Grant completed ✓"
                      : "Waiting to start…")}
                </span>
              </div>
              {grantResult && (
                <div className="mt-2 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 space-y-1">
                  <div>
                    <strong>Granted!</strong>
                  </div>
                  <div>
                    Protected Data: <span className="font-mono break-all">{grantResult.dataset}</span>
                  </div>
                  <div>
                    Price: {grantResult.datasetprice} nRLC • Volume: {grantResult.volume}
                  </div>
                  <div>iApp restrict: {String(grantResult.apprestrict)}</div>
                </div>
              )}
              {grantError && !grantInProgress && (
                <div className="mt-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-900">
                  {grantError}
                </div>
              )}
              {grantError && !grantInProgress && (
                <button
                  type="button"
                  onClick={onRetryGrant}
                  className="gradient-button"
                  style={{ padding: "8px 14px", width: "fit-content" }}
                  disabled={grantInProgress}
                >
                  Retry grant
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </motion.div>
  )
}
