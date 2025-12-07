"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import JSZip from "jszip"
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Search,
  Sparkles,
  X,
  Plus,
  Coins,
  ExternalLink,
  Filter,
  SortAsc,
  ChevronDown,
} from "lucide-react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { IExecDataProtector } from "@iexec/dataprotector"
import AddressDisplay from "./components/AddressDisplay"
import Stars from "./components/Stars"
import AlgoCard from "./components/AlgoCard"
import RunModal from "./components/RunModal"
import SellModal from "./components/SellModal"
import "./App.css"
import logo from "./assets/logo.png"

// Feature flag: control auto-loading on-chain Protected Data listings
const AUTO_LOAD_PD = import.meta.env.VITE_AUTO_LOAD_PD === 'true'
// iExec Explorer network slug (defaults to Bellecour)
const IEXEC_EXPLORER_SLUG = (import.meta.env.VITE_IEXEC_EXPLORER_SLUG || 'bellecour')

// ============================================================================
// MOCK DATA
// ============================================================================
const mockAlgos = []

const DEFAULT_AUTHORIZED_APP = "0x5240d145EBAf2EeD32c75865Ec8420667Cf51d8e"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const DEFAULT_GRANT_PRICE_NRLC = 0
const DEFAULT_GRANT_VOLUME = 1
const MAX_AUTO_GRANT_ATTEMPTS = 3
const AUTO_GRANT_RETRY_DELAY_MS = 4000
const NRLC_PER_RLC = 1_000_000_000

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function normalizeChainId(chainId) {
  if (!chainId) return null
  if (typeof chainId === "string") {
    return chainId.startsWith("0x") ? Number.parseInt(chainId, 16) : Number.parseInt(chainId, 10)
  }
  return Number(chainId)
}

function normalizeRlcInput(value, defaultValue = 0) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return defaultValue
  return num
}

function rlcToNrlc(value) {
  const rlc = normalizeRlcInput(value)
  return Math.round(rlc * NRLC_PER_RLC)
}

function formatRlcFromNrlc(nrlcValue) {
  const nrlc = Number(nrlcValue || 0)
  if (!Number.isFinite(nrlc) || nrlc === 0) return "0"
  const rlc = nrlc / NRLC_PER_RLC
  const formatted = rlc.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })
  return formatted
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function StrategyMarketplace() {
  const { login: privyLogin, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets?.find((w) => w.walletClientType === "privy") || wallets?.[0]
  const isPrivyConnected = authenticated && !!wallet
  const [chainId, setChainId] = useState(() => normalizeChainId(wallet?.chainId))

  useEffect(() => {
    setChainId(normalizeChainId(wallet?.chainId))
  }, [wallet?.chainId])

  const [dataProtectorCore, setDataProtectorCore] = useState(null)
  useEffect(() => {
    const init = async () => {
      if (isPrivyConnected && wallet) {
        try {
          const provider = await wallet.getEthereumProvider()
          const dp = new IExecDataProtector(provider, { allowExperimentalNetworks: true })
          setDataProtectorCore(dp.core)
        } catch (e) {
          console.error("Failed to init DataProtector:", e)
          setDataProtectorCore(null)
        }
      } else {
        setDataProtectorCore(null)
      }
    }
    init()
  }, [isPrivyConnected, wallet, chainId])


  // current user and hidden-list helpers
  const currentAddress = (wallet?.address || "").toLowerCase?.() || ""
  const HIDDEN_KEY = 'hiddenPdAddresses'
  const getHiddenSet = () => {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')) } catch { return new Set() }
  }
  const saveHiddenSet = (s) => {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(s))) } catch { }
  }


  // Persisted listings: fetch Protected Data on chain and map to listings
  useEffect(() => {
    // Start with an empty page unless explicitly enabled via env flag
    if (!AUTO_LOAD_PD) { setAlgos([]); return }
    const loadListings = async () => {
      if (!dataProtectorCore) return;
      try {
        const pds = await dataProtectorCore.getProtectedData();
        const strategyPDs = (pds || []).filter((pd) => {
          const s = pd?.schema || {};
          return Boolean(
            s['file-key'] ||
            s['strategy_json'] ||
            s.step1 === 'string' ||
            s.step1 === 'file'
          );
        });
        const enriched = await Promise.all(
          strategyPDs.map(async (pd) => {
            let authorizedApp;
            try {
              const ga = await dataProtectorCore.getGrantedAccess({ protectedData: pd.address });
              const first = Array.isArray(ga?.grantedAccess) ? ga.grantedAccess[0] : ga;
              if (first) authorizedApp = first.apprestrict || first.authorizedApp;
            } catch { }
            return {
              id: pd.address,
              title: pd.name || `Strategy ${pd.address.slice(0, 6)}`,
              asset: 'BTC',
              owner: pd.owner,
              description: 'Protected strategy (on-chain).',
              reliability: 0.8,
              accuracy: 0.75,
              priceEth: 0.02,
              reviews: 0,
              tags: ['protected'],
              protectedAddress: pd.address,
              authorizedApp,
            };
          })
        );
        // Filter out hidden items
        const hidden = getHiddenSet();
        const visible = enriched.filter((a) => !hidden.has((a.protectedAddress || a.id || '').toLowerCase()));
        setAlgos((prev) => {
          const byKey = new Map();
          for (const a of visible) byKey.set((a.protectedAddress || a.id).toLowerCase(), a);
          for (const p of prev) {
            const key = (p.protectedAddress || p.id).toLowerCase();
            if (!byKey.has(key) && !hidden.has(key)) byKey.set(key, p);
          }
          return Array.from(byKey.values());
        });
      } catch (e) {
        console.error('Failed to load listings from chain:', e);
      }
    };
    loadListings();
  }, [dataProtectorCore, chainId]);

  const [q, setQ] = useState("")
  const [algos, setAlgos] = useState(mockAlgos)
  const [selected, setSelected] = useState(null)
  const [sellOpen, setSellOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assetFilter, setAssetFilter] = useState("ALL")
  const [sortBy, setSortBy] = useState("reviews")
  const [lastProtectedAddress, setLastProtectedAddress] = useState(null)
  // Grant access state
  const [isGrantingAccess, setIsGrantingAccess] = useState(false)
  const [grantResult, setGrantResult] = useState(null)
  const [grantStatus, setGrantStatus] = useState("")
  const [grantError, setGrantError] = useState("")
  const [isGrantWorkflowRunning, setIsGrantWorkflowRunning] = useState(false)
  const [grantPlannedPriceNRlc, setGrantPlannedPriceNRlc] = useState(DEFAULT_GRANT_PRICE_NRLC)
  const [grantPlannedVolume, setGrantPlannedVolume] = useState(DEFAULT_GRANT_VOLUME)
  const [numSteps, setNumSteps] = useState(1)

  // Buyer run modal state
  const [runOpen, setRunOpen] = useState(false)
  const [runAlgo, setRunAlgo] = useState(null)
  const [runAppAddress, setRunAppAddress] = useState("")
  const [runStatus, setRunStatus] = useState("")
  const [runError, setRunError] = useState("")
  const [runTaskId, setRunTaskId] = useState("")
  const [runDealId, setRunDealId] = useState("")
  const [runResultPreview, setRunResultPreview] = useState("")
  const [runResultPath, setRunResultPath] = useState("")
  const [runResultUrl, setRunResultUrl] = useState("")
  const [runResultFilename, setRunResultFilename] = useState("result.txt")
  const [runStepsCount, setRunStepsCount] = useState(1)
  const [runSteps, setRunSteps] = useState([""])
  const [runResultSummary, setRunResultSummary] = useState(null)
  const [runArgs, setRunArgs] = useState("")
  const [runResultAction, setRunResultAction] = useState(null)
  const [isExecutingTx, setIsExecutingTx] = useState(false)
  const [txHash, setTxHash] = useState("")

  const clearRunResultUrl = () => {
    setRunResultUrl((prev) => {
      if (prev) {
        try { URL.revokeObjectURL(prev) } catch { }
      }
      return ""
    })
  }

  const handleRunAppAddressChange = (value) => setRunAppAddress(value)

  const handleRunStepsCountChange = (value) => {
    const n = Math.max(1, Math.min(10, Number(value) || 1))
    setRunStepsCount(n)
    setRunSteps((prev) => {
      const next = [...(prev || [])]
      if (n > next.length) {
        while (next.length < n) next.push("")
      } else if (n < next.length) {
        next.length = n
      }
      return next
    })
  }

  const handleRunStepChange = (index, value) => {
    setRunSteps((prev) => {
      const next = [...(prev || [])]
      next[index] = value
      return next
    })
  }

  const handleCloseRunModal = () => {
    clearRunResultUrl()
    setRunOpen(false)
  }

  const handleSellModalClose = () => {
    setSellOpen(false)
  }

  const handleSellStepsChange = (value) => {
    const n = Math.max(1, Math.min(10, Number(value) || 1))
    setNumSteps(n)
  }

  const resetGrantState = (statusMessage = "") => {
    setGrantResult(null)
    setGrantError("")
    setGrantStatus(statusMessage)
  }

  function openSell() {
    setLastProtectedAddress(null)
    setNumSteps(1)
    setIsGrantWorkflowRunning(false)
    resetGrantState("")
    setGrantPlannedPriceNRlc(DEFAULT_GRANT_PRICE_NRLC)
    setGrantPlannedVolume(DEFAULT_GRANT_VOLUME)
    setSellOpen(true)
  }

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    let list = algos.filter((a) => (assetFilter === "ALL" ? true : a.asset === assetFilter))
    if (k) list = list.filter((a) => a.title.toLowerCase().includes(k))
    if (sortBy === "reviews") list = [...list].sort((a, b) => b.reviews - a.reviews)
    if (sortBy === "price-low") list = [...list].sort((a, b) => a.priceEth - b.priceEth)
    if (sortBy === "price-high") list = [...list].sort((a, b) => b.priceEth - a.priceEth)
    return list
  }, [q, algos, assetFilter, sortBy])

  const grantInProgress = isGrantWorkflowRunning || isGrantingAccess
  const grantPriceRlcDisplay = useMemo(
    () => formatRlcFromNrlc(grantPlannedPriceNRlc),
    [grantPlannedPriceNRlc]
  )

  function handleRunSignal(algo) {
    setRunAlgo(algo)
    setRunAppAddress(algo?.authorizedApp || "")
    setRunStatus("")
    setRunError("")
    setRunTaskId("")
    setRunDealId("")
    setRunResultPreview("")

    // NEW RESET LOGIC
    setRunArgs("")
    setRunResultAction(null)
    setRunResultSummary(null)
    setIsExecutingTx(false)
    setTxHash("")

    setRunOpen(true)
  }

  async function handleRunIapp(e) {
    e.preventDefault()
    if (!dataProtectorCore) { alert("Please connect your wallet (Privy) first."); return }
    if (!runAlgo?.protectedAddress) { setRunError("This strategy does not include a protected data address."); return }
    if (!runAppAddress) { setRunError("Please provide the iApp address to run."); return }
    setRunError("")
    setRunStatus("Requesting wallet signature…")
    setRunResultSummary(null)
    try {
      //const finalArgs = `${wallet.address} ${runArgs}`.trim()
      const finalArgs = `{"wallet":"${wallet.address}","amount":${runArgs}}`
      const stepsClean = (runSteps || []).map((s) => String(s || '').trim()).filter(Boolean)
      const args = stepsClean.length ? JSON.stringify({ steps: stepsClean }) : ""
      const res = await dataProtectorCore.processProtectedData({
        protectedData: runAlgo.protectedAddress,
        app: runAppAddress,
        args: finalArgs,
        encryptResult: true,
        path: runResultPath || undefined,
        dataMaxPrice: Number.MAX_SAFE_INTEGER,
        appMaxPrice: Number.MAX_SAFE_INTEGER,
        workerpoolMaxPrice: Number.MAX_SAFE_INTEGER,
        onStatusUpdate: ({ title, isDone, payload }) => {
          const suffix = isDone ? ' ✓' : ''
          setRunStatus(`${title}${suffix}`)
          if (payload?.taskId) setRunTaskId(payload.taskId)
          if (payload?.dealId) setRunDealId(payload.dealId)
        },
      })
      // ensure task/deal ids populated
      setRunTaskId(res.taskId || runTaskId)
      setRunDealId(res.dealId || runDealId)

      const consumeResult = async (buffer) => {
        try {
          let arrBuf = null
          if (buffer instanceof ArrayBuffer) arrBuf = buffer
          else if (buffer?.buffer instanceof ArrayBuffer) arrBuf = buffer.buffer
          if (!arrBuf) return false
          let workingBuffer = arrBuf
          let filename = (runResultPath && runResultPath.split('/').pop()) || null
          const bytes = new Uint8Array(arrBuf)
          const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
          if (isZip) {
            try {
              const zip = await JSZip.loadAsync(arrBuf)
              const normalizedPath = (runResultPath || '').replace(/^\/+/, '')
              let fileEntry = normalizedPath ? zip.file(normalizedPath) : null
              if (!fileEntry && normalizedPath) {
                const fileNameOnly = normalizedPath.split('/').pop()
                if (fileNameOnly) {
                  fileEntry = zip.filter((relPath, file) => !file.dir && relPath.split('/').pop() === fileNameOnly)[0]
                }
              }
              if (!fileEntry) {
                const candidates = Object.values(zip.files).filter((file) => !file.dir)
                fileEntry = candidates[0]
              }
              if (!fileEntry) return false
              filename = fileEntry.name.split('/').pop() || filename
              workingBuffer = await fileEntry.async('arraybuffer')
            } catch (zipErr) {
              console.warn('Failed to unzip result buffer:', zipErr)
              return false
            }
          }
          const workingBytes = new Uint8Array(workingBuffer)
          let isText = false
          let text = ''
          try {
            text = new TextDecoder().decode(workingBytes)
            isText = /[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFD]/.test(text)
          } catch { }
          if (isText) {
            let preview = text.slice(0, 2000)
            try {
              const parsed = JSON.parse(text)
              if (parsed?.action && parsed?.action?.calldata) {
                setRunResultAction(parsed.action)
                setRunResultSummary(parsed.message || "Transaction generated successfully.")
                preview = "Transaction Ready for Execution"
              } else if (parsed && typeof parsed === 'object') {
                if ('fiability-score' in parsed) {
                  const score = parsed['fiability-score']
                  preview = `Fiability score: ${score}`
                }
                const explanations = Array.isArray(parsed?.explanations) ? parsed.explanations : []
                const fallbackBuyLine = explanations.find((line) => typeof line === 'string' && /\[fallback\s+BUY]/i.test(line))
                const fallbackSellLine = explanations.find((line) => typeof line === 'string' && /\[fallback\s+SELL]/i.test(line))
                const recommendation = parsed?.recommendation || {}
                const buyPercentValue =
                  typeof recommendation.buy_percent === 'number'
                    ? recommendation.buy_percent
                    : typeof recommendation.percent === 'number'
                      ? recommendation.percent
                      : fallbackBuyLine
                        ? Number.parseFloat((fallbackBuyLine.match(/([0-9]+(?:\.[0-9]+)?)%/i) || [])[1])
                        : undefined
                const sellPercentValue =
                  typeof recommendation.sell_percent === 'number'
                    ? recommendation.sell_percent
                    : fallbackSellLine
                      ? Number.parseFloat((fallbackSellLine.match(/([0-9]+(?:\.[0-9]+)?)%/i) || [])[1])
                      : undefined
                const hasBuyPercent =
                  typeof buyPercentValue === 'number' && !Number.isNaN(buyPercentValue)
                const hasSellPercent =
                  typeof sellPercentValue === 'number' && !Number.isNaN(sellPercentValue)
                if (hasBuyPercent || hasSellPercent) {
                  const fmt = (value) => {
                    if (value == null || Number.isNaN(value)) return null
                    const num = Number(value)
                    if (!Number.isFinite(num)) return null
                    const fixed = Number.isInteger(num) ? num.toString() : num.toFixed(2)
                    return fixed.replace(/\.?0+$/, '')
                  }
                  const buyPct = hasBuyPercent ? fmt(buyPercentValue) : null
                  const sellPct = hasSellPercent ? fmt(sellPercentValue) : null
                  const advicePieces = []
                  if (buyPct) advicePieces.push(`${buyPct}% of your capital to long`)
                  if (sellPct) advicePieces.push(`${sellPct}% to short`)
                  const advice =
                    advicePieces.length > 0
                      ? `Use ${advicePieces.join(' and ')}.`
                      : ''
                  if (advice) {
                    setRunResultSummary(advice)
                  }
                  const fallbackText = [fallbackBuyLine, fallbackSellLine].filter(Boolean).join('\n')
                  if (fallbackText) {
                    preview = fallbackText
                  } else if (advice) {
                    preview = advice
                  } else {
                    preview = ''
                  }
                }
              }
            } catch { /* non-JSON content keeps original preview */ }
            setRunResultPreview(preview)
          }
          const mime = isText ? 'text/plain' : 'application/octet-stream'
          const blob = new Blob([workingBuffer], { type: mime })
          const url = URL.createObjectURL(blob)
          setRunResultUrl(url)
          const fname = filename || (isText ? 'result.txt' : 'result.bin')
          setRunResultFilename(fname)
          return true
        } catch { return false }
      }

      let got = false
      if (res?.result) got = await consumeResult(res.result)
      if (!got) {
        try {
          const tid = res.taskId || runTaskId
          if (tid) {
            const fetched = await dataProtectorCore.getResultFromCompletedTask({ taskId: tid, path: runResultPath || undefined })
            if (fetched?.result) got = await consumeResult(fetched.result)
          }
        } catch (e) {
          console.warn('Explicit result fetch failed:', e)
        }
      }
      if (!got) {
        setRunError('Run completed but no result file was retrieved. Ensure your iApp writes a result file into iexec_out.')
      }
      setRunStatus("iApp run completed ✓")
    } catch (err) {
      console.error("Run iApp failed:", err)
      const message = err?.message || "Failed to run iApp. Check inputs and try again."
      if (/No App order found/i.test(message)) {
        setRunError(message + " — The iApp owner must publish an App Order (TEE tagged) on this network so buyers can run it.")
      } else if (/Failed to process task result|no such file|not found/i.test(message)) {
        setRunError("Result processing failed. Ensure your iApp writes a result file inside iexec_out.")
      } else {
        setRunError(message)
      }
    }
  }

  async function handleExecuteTx() {
    if (!runResultAction || !wallet) return
    setIsExecutingTx(true)
    try {
      const provider = await wallet.getEthereumProvider()

      // Request signature from user's wallet
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: wallet.address,
          to: runResultAction.target_contract,
          data: runResultAction.calldata,
          value: runResultAction.value || "0x0" // value is hex string
        }]
      })

      setTxHash(txHash)
    } catch (e) {
      console.error("Transaction failed:", e)
      alert("Transaction failed: " + e.message)
    } finally {
      setIsExecutingTx(false)
    }
  }

  // Delist handler: revoke access and hide locally
  async function handleDelist(algo) {
    try {
      if (!algo?.protectedAddress) return
      if (!dataProtectorCore) { alert('Connect your wallet first'); return }
      if (!currentAddress || (algo.owner && String(algo.owner).toLowerCase() !== currentAddress)) {
        alert('You can only delist items you own')
        return
      }
      const ok = confirm('Delist this strategy? This revokes all access and hides it from your view.')
      if (!ok) return
      await dataProtectorCore.revokeAllAccess({ protectedData: algo.protectedAddress })
      const hidden = getHiddenSet()
      hidden.add((algo.protectedAddress || '').toLowerCase())
      saveHiddenSet(hidden)
      setAlgos((prev) => prev.filter((a) => (a.protectedAddress || a.id).toLowerCase() !== (algo.protectedAddress || '').toLowerCase()))
    } catch (e) {
      console.error('Delist failed:', e)
      alert('Failed to delist. Check console for details.')
    }
  }

  function handleOpenDocs() {
    window.open("https://docs.iex.ec/get-started/helloWorld", "_blank")
  }

  async function handleSubmitAlgo(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const form = Object.fromEntries(fd.entries())
    setSubmitting(true)

    try {
      if (!isPrivyConnected || !dataProtectorCore) {
        alert("Please connect your wallet (Privy) before listing.")
        await privyLogin()
        setSubmitting(false)
        return
      }

      // 1. Get the uploaded file
      const file = fd.get("strategyFile")
      if (!file || !file.name.endsWith(".py")) {
        alert("Please upload a valid .py Python strategy file.")
        setSubmitting(false)
        return
      }

      // 2. ZIP the file as "strategy.py"
      // This ensures the generic runner always finds "strategy.py" regardless of what the user named it
      const zip = new JSZip()
      const fileContent = await file.arrayBuffer()
      zip.file("strategy.py", fileContent)


      const zipBlob = await zip.generateAsync({ type: "uint8array" })

      const priceRlc = normalizeRlcInput(form.priceEth ?? 0.02, 0.02)
      const priceNRlc = rlcToNrlc(priceRlc)

      // 3. Protect the ZIP
      const result = await dataProtectorCore.protectData({
        name: String(form.title || "DeFi Strategy"),
        data: {
          // The key doesn't matter much if we mount the whole zip, 
          // but "application/zip" is standard for file buffers
          zipfile: zipBlob
        },
      })

      const protectedAddress = result.address

      // 4. Update Local State
      const newAlgo = {
        id: `s${Date.now()}`,
        title: String(form.title),
        asset: String(form.asset),
        owner: wallet?.address || "you",
        priceEth: priceRlc,
        reviews: 0,
        protectedAddress,
        winRate: null, // No winrate for new strategies
        tags: ['DeFi', 'Calldata'],
      }

      setAlgos((prev) => [newAlgo, ...prev])
      setLastProtectedAddress(protectedAddress)
      setGrantPlannedPriceNRlc(priceNRlc)
      setGrantPlannedVolume(DEFAULT_GRANT_VOLUME)
      resetGrantState("Auto grant scheduled…")

      // 5. Start Grant Workflow
      startGrantWorkflow({
        protectedData: protectedAddress,
        prefix: "Auto grant",
        maxAttempts: MAX_AUTO_GRANT_ATTEMPTS,
        delayMs: AUTO_GRANT_RETRY_DELAY_MS,
        pricePerAccess: priceNRlc,
        numberOfAccess: DEFAULT_GRANT_VOLUME,
      })

    } catch (err) {
      console.error("Protect strategy failed:", err)
      alert("Failed to protect strategy. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function executeGrantAccess({
    protectedData,
    authorizedApp,
    authorizedUser = ZERO_ADDRESS,
    pricePerAccess = DEFAULT_GRANT_PRICE_NRLC,
    numberOfAccess = DEFAULT_GRANT_VOLUME,
    statusPrefix = "",
  }) {
    if (!dataProtectorCore) {
      throw new Error("Wallet/provider not ready. Connect with Privy first.")
    }
    const protectedDataAddress = String(protectedData || "").trim()
    if (!protectedDataAddress) {
      throw new Error("No protected data address provided.")
    }
    const appAddress = String(authorizedApp || "").trim()
    if (!appAddress) {
      throw new Error("No authorized app address provided.")
    }
    const userAddress = String(authorizedUser || ZERO_ADDRESS).trim() || ZERO_ADDRESS
    const prefix = statusPrefix ? `${statusPrefix} ` : ""
    setIsGrantingAccess(true)
    setGrantError("")
    setGrantStatus(`${prefix}Requesting wallet signature…`)
    try {
      const price = Math.max(0, Math.trunc(Number(pricePerAccess) || 0))
      const volume = Math.max(1, Math.trunc(Number(numberOfAccess) || 1))
      const res = await dataProtectorCore.grantAccess({
        protectedData: protectedDataAddress,
        authorizedApp: appAddress,
        authorizedUser: userAddress,
        pricePerAccess: price,
        numberOfAccess: volume,
        onStatusUpdate: ({ title, isDone }) => {
          setGrantStatus(`${prefix}${title}${isDone ? ' ✓' : ''}`)
          console.log(`Grant Access Status: ${title}, Done: ${isDone}`)
        },
      })
      setGrantResult(res)
      const datasetPriceNumeric = Number(res?.datasetprice)
      setGrantPlannedPriceNRlc(Number.isFinite(datasetPriceNumeric) ? datasetPriceNumeric : price)
      const datasetVolumeNumeric = Number(res?.volume)
      setGrantPlannedVolume(Number.isFinite(datasetVolumeNumeric) && datasetVolumeNumeric > 0 ? datasetVolumeNumeric : volume)
      setAlgos((prev) =>
        prev.map((a) =>
          (a.protectedAddress || a.id) === protectedDataAddress ? { ...a, authorizedApp: appAddress } : a
        )
      )
      setGrantStatus(`${prefix}Access granted ✓`)
      return res
    } catch (err) {
      setGrantError(err?.message || "Failed to grant access. Check inputs and try again.")
      throw err
    } finally {
      setIsGrantingAccess(false)
    }
  }

  // Auto grant workflow: retry a few times in case the dataset is not immediately ready on-chain.
  async function startGrantWorkflow({
    protectedData,
    prefix = "Auto grant",
    maxAttempts = 1,
    delayMs = AUTO_GRANT_RETRY_DELAY_MS,
    pricePerAccess = DEFAULT_GRANT_PRICE_NRLC,
    numberOfAccess = DEFAULT_GRANT_VOLUME,
  }) {
    if (!protectedData) return false
    if (isGrantWorkflowRunning) return false
    setIsGrantWorkflowRunning(true)
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const attemptLabel = maxAttempts > 1 ? ` (attempt ${attempt + 1}/${maxAttempts})` : ""
        const statusPrefix = `${prefix}${attemptLabel}`
        try {
          await executeGrantAccess({
            protectedData,
            authorizedApp: DEFAULT_AUTHORIZED_APP,
            authorizedUser: ZERO_ADDRESS,
            pricePerAccess,
            numberOfAccess,
            statusPrefix,
          })
          return true
        } catch (err) {
          console.error(`${prefix} attempt ${attempt + 1} failed:`, err)
          if (attempt + 1 >= maxAttempts) {
            setGrantStatus(`${prefix} failed after ${maxAttempts} attempts.`)
            return false
          }
          setGrantStatus(`${prefix} attempt ${attempt + 1} failed. Retrying…`)
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, delayMs)))
        }
      }
      return false
    } finally {
      setIsGrantWorkflowRunning(false)
    }
  }

  async function handleGrantAccess(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (!dataProtectorCore) {
      alert("Wallet/provider not ready. Connect with Privy first.")
      return
    }
    if (!lastProtectedAddress) {
      alert("Protect your strategy first to get its address.")
      return
    }
    if (isGrantWorkflowRunning || isGrantingAccess) return
    resetGrantState("Manual grant scheduled…")
    startGrantWorkflow({
      protectedData: lastProtectedAddress,
      prefix: "Manual grant",
      maxAttempts: MAX_AUTO_GRANT_ATTEMPTS,
      delayMs: AUTO_GRANT_RETRY_DELAY_MS,
      pricePerAccess: grantPlannedPriceNRlc,
      numberOfAccess: grantPlannedVolume,
    })
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f1e8",
        color: "#1a1a1a",
      }}
    >
      {/* HEADER */}
      <header className="header">
        <div className="header-content">
          <div className="header-logo">
            <img src={logo} alt="Logo" style={{ height: 80, width: "auto", marginRight: 8 }} />
            <span className="gradient-text" style={{ fontSize: "40px" }}>TradeVault</span>
          </div>
          <div className="header-actions">
            <button className="gradient-button" onClick={openSell}>
              <Plus size={16} />
              Sell Strategy
            </button>
            <button className="glass-button" onClick={privyLogin}>
              <KeyRound size={16} />
              {isPrivyConnected ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : "Connect"}
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-grid">
          <div>
            <h1 className="hero-title">
              Discover <span className="gradient-text">TradeVault</span>
            </h1>
            <p className="hero-description">
              Pay per use in RLC, run inside iExec TEEs, receive a clean allocation signal. Strategies remain
              private.
            </p>
            <div className="hero-features">
              <div className="hero-feature">
                <Lock size={16} />
                Data protected
              </div>
              <div className="hero-feature">
                <Coins size={16} />
                RLC payments
              </div>
              <div className="hero-feature">
                <Sparkles size={16} />
                TEE attestation
              </div>
            </div>
            <div className="hero-actions">
              <button className="gradient-button" onClick={openSell}>
                List your strategy
              </button>
              <button className="glass-button" onClick={handleOpenDocs}>
                iExec Docs
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
          <div className="hero-card-wrapper" style={{ position: "relative" }}>
            <div className="hero-card" style={{ position: "relative", zIndex: 2 }}>
              <div className="hero-card-label">
                <Lock size={16} /> TEE enclave
              </div>
              <div className="hero-card-title">Execute privately, pay in RLC</div>
              <p className="hero-card-description">
                Monetize strategies without revealing code or data. On-chain receipts, auditable events, confidential
                compute with iExec.
              </p>
              <div className="hero-card-grid">
                {["RLC payments", "Access control", "Attestation"].map((k) => (
                  <div key={k} className="hero-card-item">
                    <div className="hero-card-item-title">{k}</div>
                    <div className="hero-card-item-subtitle"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-separator"></div>

      {/* SEARCH & FILTER */}
      <section className="search-filter-section">
        <div className="search-filter-grid">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, description, or tags"
              className="form-input search-input"
            />
          </div>
          <div className="filter-select-wrapper">
            <Filter className="filter-icon" />
            <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className="form-select">
              <option value="ALL">All assets</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>
            <ChevronDown className="chevron-icon" />
          </div>
          <div className="sort-select-wrapper">
            <SortAsc className="sort-icon" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="form-select">
              <option value="reviews">Sort by reviews</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
            <ChevronDown className="chevron-icon" />
          </div>
        </div>
      </section>

      <div className="section-separator"></div>

      {/* STRATEGY GRID */}
      <main className="strategy-grid">
        <div className="grid">
          {filtered.map((algo) => (
            <motion.div key={algo.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AlgoCard
                algo={algo}
                onSelect={() => setSelected(algo)}
                onRun={() => handleRunSignal(algo)}
                onDelist={handleDelist}
                canDelist={String(algo.owner || '').toLowerCase() === currentAddress}
              />
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="grid-empty">No results.</div>}
        </div>
      </main>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="modal-detail"
              initial={{ x: 560 }}
              animate={{ x: 0 }}
              exit={{ x: 560 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 className="modal-title">{selected.title}</h3>
                <button className="modal-close-button" onClick={() => setSelected(null)}>
                  <X size={20} style={{ color: "#1a1a1a" }} />
                </button>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  border: "3px solid #000000",
                  boxShadow: "3px 3px 0px #000000",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                {selected.reviews === 0 ? (
                  <>
                    <Stars n={0} isEmpty={true} />
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a1a" }}>Not reviewed yet</span>
                  </>
                ) : (
                  <>
                    <Stars n={Math.max(1, Math.round((selected.winRate || 70) / 20))} />
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a1a" }}>
                      {((selected.winRate || 70) / 20).toFixed(1)}
                    </span>
                    <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "600" }}>
                      ({selected.reviews} reviews)
                    </span>
                  </>
                )}
              </div>

              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: "14px",
                  color: "#1a1a1a",
                  fontWeight: "600",
                }}
              >
                <span className="badge-asset">{selected.asset}</span>
              </div>

              <div style={{ marginTop: "24px" }}>
                <button
                  className="gradient-button"
                  onClick={() => handleRunSignal(selected)}
                  style={{ width: "100%", padding: "14px 20px", fontSize: "16px" }}
                >
                  Run iApp
                </button>
              </div>

              {selected.protectedAddress && (
                <div style={{ marginTop: "24px" }}>
                  <h4 style={{ fontWeight: "700", color: "#1a1a1a", fontSize: "15px", marginBottom: "12px" }}>
                    Protected data
                  </h4>
                  <div style={{ marginTop: "8px" }}>
                    <AddressDisplay address={selected.protectedAddress} />
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buyer run modal */}
      <AnimatePresence>
        {runOpen && runAlgo && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseRunModal}
          >
            <RunModal
              algo={runAlgo}
              onClose={handleCloseRunModal}
              onSubmit={handleRunIapp}
              runAppAddress={runAppAddress}
              onRunAppAddressChange={handleRunAppAddressChange}

              // NEW PROPS
              userAddress={wallet?.address}
              runArgs={runArgs}
              onRunArgsChange={setRunArgs}
              runResultAction={runResultAction}
              runResultSummary={runResultSummary}
              onExecuteTx={handleExecuteTx}
              isExecutingTx={isExecutingTx}
              txHash={txHash}

              // Existing status props
              runStatus={runStatus}
              runError={runError}
              runTaskId={runTaskId}
              runDealId={runDealId}
              runResultPreview={runResultPreview}
              runResultUrl={runResultUrl}
              runResultFilename={runResultFilename}
              explorerSlug={IEXEC_EXPLORER_SLUG}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SELL MODAL */}
      <AnimatePresence>
        {sellOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSellModalClose}
          >
            <SellModal
              onClose={handleSellModalClose}
              onSubmit={handleSubmitAlgo}
              numSteps={numSteps}
              onNumStepsChange={handleSellStepsChange}
              submitting={submitting}
              lastProtectedAddress={lastProtectedAddress}
              defaultAuthorizedApp={DEFAULT_AUTHORIZED_APP}
              grantStatus={grantStatus}
              grantResult={grantResult}
              grantError={grantError}
              grantInProgress={grantInProgress}
              onRetryGrant={handleGrantAccess}
              grantPriceNrlc={grantPlannedPriceNRlc}
              grantPriceRlcDisplay={grantPriceRlcDisplay}
              grantVolume={grantPlannedVolume}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <ShieldCheck size={16} />
            Privacy by design – iExec TEE
          </div>
          <div>Arbitrum Sepolia • ETH payments</div>
        </div>
      </footer>
    </div>
  )
}
