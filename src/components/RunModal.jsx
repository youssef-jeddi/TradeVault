import { motion } from "framer-motion"
import { X } from "lucide-react"

export default function RunModal({
  algo,
  onClose,
  onSubmit,
  runAppAddress,
  onRunAppAddressChange,
  runStepsCount,
  onRunStepsCountChange,
  runSteps,
  onRunStepChange,
  runStatus,
  runError,
  runTaskId,
  runDealId,
  runResultPreview,
  runResultUrl,
  runResultFilename,
  explorerSlug,
}) {
  if (!algo) return null

  return (
    <motion.div
      className="modal-sell"
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h3 className="modal-title">Run iApp for “{algo.title}”</h3>
        <button className="modal-close-button" onClick={onClose}>
          <X size={20} style={{ color: "#94a3b8" }} />
        </button>
      </div>

      {!algo.protectedAddress ? (
        <div
          className="success-message"
          style={{ background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
        >
          This listing has no protected data address. Ask the seller to protect and grant access.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">iApp address</label>
            <input
              value={runAppAddress}
              onChange={(e) => onRunAppAddressChange(e.target.value)}
              placeholder="0x... app address granted to read this PD"
              className="form-input"
              maxLength={42}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Number of Steps</label>
            <input
              type="number"
              min={1}
              max={10}
              value={runStepsCount}
              onChange={(e) => onRunStepsCountChange(Number(e.target.value))}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Your Steps</label>
            <div className="form-steps">
              {Array.from({ length: runStepsCount }).map((_, i) => (
                <div key={i}>
                  <input
                    value={runSteps[i] || ""}
                    onChange={(e) => onRunStepChange(i, e.target.value)}
                    placeholder={`Step ${i + 1}`}
                    className="form-input"
                  />
                </div>
              ))}
            </div>
            <p className="form-steps-note">
              These steps describe your comparison sequence. The iApp can compare them with the seller's
              protected steps to compute a similarity score.
            </p>
            <p className="form-steps-note">
              Make sure your wallet has deposited enough eRLC into your iExec account—the marketplace will
              escrow the run price automatically when you launch the task.
            </p>
          </div>
          <div className="form-actions">
            <div className="text-xs text-zinc-500">{runStatus}</div>
            <button type="submit" className="gradient-button">
              Run iApp
            </button>
          </div>

          {runError && (
            <div
              className="success-message"
              style={{ background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" }}
            >
              {runError}
            </div>
          )}
          {(runTaskId || runDealId) && (
            <div className="text-xs text-zinc-500" style={{ marginTop: 8 }}>
              {runDealId && <div>Deal: {runDealId}</div>}
              {runTaskId && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span>Task: {runTaskId}</span>
                  <a
                    href={`https://explorer.iex.ec/${explorerSlug}/task/${runTaskId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open in iExec Explorer
                  </a>
                </div>
              )}
            </div>
          )}
          {runResultUrl && (
            <div className="form-group">
              <label className="form-label">Result preview</label>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "#f8fafc",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  maxHeight: 240,
                  overflow: "auto",
                }}
              >
                {runResultPreview || "(binary content)"}
              </pre>
              <a
                href={runResultUrl}
                download={runResultFilename}
                className="gradient-button"
                style={{ display: "inline-flex", marginTop: 8, textDecoration: "none" }}
              >
                Download {runResultFilename}
              </a>
            </div>
          )}
        </form>
      )}
    </motion.div>
  )
}
