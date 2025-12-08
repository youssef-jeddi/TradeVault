import { motion } from "framer-motion"
import { X, Play, Wallet, Terminal, ExternalLink, Loader2 } from "lucide-react" // Added ExternalLink & Loader2

export default function RunModal({
  algo,
  onClose,
  onSubmit,
  runAppAddress,
  onRunAppAddressChange,
  userAddress,
  runArgs,
  onRunArgsChange,
  runStatus,
  runError,
  runTaskId,
  runDealId,
  runResultSummary,
  runResultAction,
  onExecuteTx,
  isExecutingTx,
  txHash,
  explorerSlug = 'bellecour' // Default to bellecour if undefined
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
        <h3 className="modal-title">Run Strategy: {algo.title}</h3>
        <button className="modal-close-button" onClick={onClose}>
          <X size={20} style={{ color: "#94a3b8" }} />
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-xs text-blue-800">
        <strong>How it works:</strong> The strategy runs inside a TEE. It will generate a transaction for you to sign.
        No funds move until you approve the final output.
      </div>

      {!algo.protectedAddress ? (
        <div className="success-message text-amber-700 bg-amber-50 border-amber-200">
          This listing has no protected data address.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="modal-form">
          {/* 1. Target Wallet Field (Read-only) */}
          <div className="form-group">
            <label className="form-label flex items-center gap-2">
              <Wallet size={14} /> Target Wallet (You)
            </label>
            <input
              value={userAddress || ""}
              disabled
              className="form-input bg-zinc-100 text-zinc-500 cursor-not-allowed font-mono text-sm"
            />
          </div>

          {/* 2. Execution Arguments */}
          <div className="form-group">
            <label className="form-label flex items-center gap-2">
              <Terminal size={14} /> Input Parameters
            </label>
            <input
              value={runArgs}
              onChange={(e) => onRunArgsChange(e.target.value)}
              placeholder="e.g., 1000 (USDC Amount)"
              className="form-input font-mono"
              required
            />
          </div>

          {/* 3. Run Action */}
          <div className="form-actions">
            <div className="text-xs text-zinc-500 font-medium flex items-center gap-2">
              {runStatus && runStatus.includes("...") && <Loader2 size={12} className="animate-spin" />}
              {runStatus}
            </div>
            <button
              type="submit"
              className="gradient-button flex items-center gap-2"
              disabled={!!runResultAction || (runStatus && runStatus.includes("..."))}
            >
              <Play size={16} fill="currentColor" />
              {runResultAction ? "Generation Complete" : "Generate Transaction"}
            </button>
          </div>

          {/* --- NEW: Task ID & Explorer Link --- */}
          {runTaskId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4"
            >
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">iExec Task ID</span>
                  <span className="font-mono text-xs text-zinc-700 truncate w-48" title={runTaskId}>
                    {runTaskId}
                  </span>
                </div>
                <a
                  href={`https://explorer.iex.ec/${explorerSlug}/task/${runTaskId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  View on Explorer <ExternalLink size={12} />
                </a>
              </div>
            </motion.div>
          )}
          {/* ------------------------------------- */}

          {/* Error Message */}
          {runError && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {runError}
            </div>
          )}

          {/* 4. EXECUTION ZONE */}
          {runResultAction && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 border-t-2 border-dashed border-zinc-200 pt-6"
            >
              <h4 className="text-sm font-bold text-zinc-800 mb-3 uppercase tracking-wide">
                Strategy Output
              </h4>

              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 mb-4">
                <p className="text-zinc-700 text-sm font-medium">
                  {runResultSummary || "Strategy execution successful."}
                </p>
              </div>

              {!txHash ? (
                <button
                  type="button"
                  onClick={onExecuteTx}
                  disabled={isExecutingTx}
                  className="w-full py-4 rounded-xl font-bold text-white shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-3"
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    opacity: isExecutingTx ? 0.8 : 1
                  }}
                >
                  {isExecutingTx ? "Check your wallet..." : "🚀 Execute Transaction on Chain"}
                </button>
              ) : (
                <div className="p-4 bg-green-100 text-green-800 rounded-xl border border-green-200 text-center font-bold">
                  Transaction Sent! 🎉
                  <div className="text-xs font-normal mt-1 opacity-80 break-all">{txHash}</div>
                </div>
              )}
            </motion.div>
          )}
        </form>
      )}
    </motion.div>
  )
}