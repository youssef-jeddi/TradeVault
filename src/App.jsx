"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import JSZip from "jszip"
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Star,
  Search,
  Sparkles,
  X,
  Plus,
  Coins,
  ArrowRight,
  ExternalLink,
  Filter,
  SortAsc,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react"
import { ethers } from "ethers"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { IExecDataProtector } from "@iexec/dataprotector"
import InteractiveSphere from "./components/InteractiveSphere"
import "./App.css"

// Feature flag: control auto-loading on-chain Protected Data listings
const AUTO_LOAD_PD = import.meta.env.VITE_AUTO_LOAD_PD === 'true'
// iExec Explorer network slug (defaults to Bellecour)
const IEXEC_EXPLORER_SLUG = (import.meta.env.VITE_IEXEC_EXPLORER_SLUG || 'bellecour')

// ============================================================================
// MOCK DATA
// ============================================================================
const mockAlgos = []

// Optional market contract to receive ETH payments. If not provided, we'll fallback
// to paying the seller directly (algo.owner) after a user confirmation.
const MARKET_ADDRESS = ""
const ARBITRUM_SEPOLIA = {
  chainIdHex: "0x66EEE",
  chainId: 421614,
  chainName: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
  blockExplorerUrls: ["https://sepolia.arbiscan.io"],
}

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

function shortenAddress(address) {
  if (!address) return ""
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Removed ReliabilityBadge and AccuracyBadge components

function Stars({ n = 4, isEmpty = false }) {
  return (
    <span style={{ display: "inline-flex", gap: "2px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          style={{
            fill: isEmpty ? "transparent" : i < n ? "#fbbf24" : "transparent",
            stroke: isEmpty ? "#cbd5e1" : i < n ? "#fbbf24" : "#cbd5e1",
            strokeWidth: 2,
          }}
        />
      ))}
    </span>
  )
}

function AddressDisplay({ address }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const value = String(address || '')
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const addrStr = String(address || '')
  return (
    <div className="address-display" onClick={handleToggle}>
      {expanded ? addrStr : shortenAddress(addrStr)}
      <button className="address-copy-button" onClick={handleCopy} title={copied ? "Copied!" : "Copy address"}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}

function AlgoCard({ algo, onSelect, onPay, onDelist, canDelist }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
      className="strategy-card"
    >
      <div className="strategy-card-header">
        <div className="strategy-card-title-section">
          <div className="strategy-card-title-row">
            <span className="badge-asset">{algo.asset}</span>
            <h3 className="strategy-card-title">{algo.title}</h3>
          </div>
        </div>
        {isHovered && (
          <button
            className="strategy-card-arrow"
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            title="View details"
          >
            <ArrowRight size={18} />
          </button>
        )}
      </div>

      <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            background: "#dbeafe",
            border: "2px solid #000000",
            fontSize: "12px",
            fontWeight: "700",
            color: "#1a1a1a",
          }}
        >
          {algo.reviews} reviews
        </span>
      </div>

      <div className="strategy-card-metrics">
        {algo.reviews === 0 ? (
          <>
            <Stars n={0} isEmpty={true} />
            <span style={{ color: "#64748b", fontWeight: "600" }}>Not reviewed yet</span>
          </>
        ) : (
          <>
            <Stars n={Math.max(1, Math.round((algo.winRate || 70) / 20))} />
            <span style={{ color: "#64748b" }}>({algo.reviews})</span>
          </>
        )}
      </div>

      <div className="strategy-card-footer">
        <div className="strategy-card-owner">
          By <AddressDisplay address={algo.owner} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canDelist && (
            <button
              className="glass-button"
              style={{ padding: '6px 10px' }}
              onClick={(e) => { e.stopPropagation(); onDelist?.(algo); }}
            >
              Delist
            </button>
          )}
          <button
            className="strategy-card-price-button"
            onClick={(e) => {
              e.stopPropagation()
              onPay()
            }}
          >
            Pay
          </button>
        </div>
      </div>
    </motion.div>
  )
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
  const [grantAuthorizedApp, setGrantAuthorizedApp] = useState("")
  const [grantAuthorizedUser, setGrantAuthorizedUser] = useState("0x0000000000000000000000000000000000000000")
  const [grantPricePerAccess, setGrantPricePerAccess] = useState(0)
  const [grantNumberOfAccess, setGrantNumberOfAccess] = useState(1)
  const [isGrantingAccess, setIsGrantingAccess] = useState(false)
  const [grantResult, setGrantResult] = useState(null)
  const [grantStatus, setGrantStatus] = useState("")
  const [grantError, setGrantError] = useState("")
  const [numSteps, setNumSteps] = useState(1)

  // Buyer run modal state
  const [runOpen, setRunOpen] = useState(false)
  const [runAlgo, setRunAlgo] = useState(null)
  const [runAppAddress, setRunAppAddress] = useState("")
  const [runDpKey, setRunDpKey] = useState("file-key")
  const [runSchema, setRunSchema] = useState("file")
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
  const [hasPaidForRun, setHasPaidForRun] = useState(false)

  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stepsCount, setStepsCount] = useState(1);
  const [steps, setSteps] = useState([""]);


  function openSell() {
    setLastProtectedAddress(null)
    setNumSteps(1)
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

  async function handlePayEth(algo) {
    try {
      if (!account) {
        await handleConnectWallet();
        if (!account && !window.ethereum) return false;
      }
      if (!window.ethereum) {
        alert("No wallet available.");
        return false;
      }
      const browserProvider = provider ?? new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();
      // Resolve recipient: prefer configured market address; otherwise fallback to seller address
      let recipient = MARKET_ADDRESS;
      if (!recipient) {
        const seller = String(algo?.owner || '').trim();
        const isAddr = /^0x[a-fA-F0-9]{40}$/.test(seller);
        if (!isAddr) {
          alert("No market configured and seller address is invalid. Set VITE_MARKET_ADDRESS in .env.");
          return false;
        }
        const ok = confirm(`No market contract configured. Send ${algo.priceEth} ETH directly to the seller?\n\nSeller: ${seller}`);
        if (!ok) return false;
        recipient = seller;
      }
      const tx = await signer.sendTransaction({ to: recipient, value: ethers.parseEther(String(algo.priceEth)) });
      await tx.wait();
      return true;
    } catch (e) {
      console.error(e);
      alert("Payment failed.");
      return false;
    }
  }

  async function handleConnectWallet() {
    try {
      if (!window.ethereum) {
        alert("No wallet found. Please install MetaMask or a compatible wallet.");
        return;
      }
      setIsConnecting(true);
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const net = await browserProvider.getNetwork();
      if (Number(net.chainId) !== ARBITRUM_SEPOLIA.chainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ARBITRUM_SEPOLIA.chainIdHex }],
          });
        } catch (err) {
          if (err && err.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: ARBITRUM_SEPOLIA.chainIdHex,
                chainName: ARBITRUM_SEPOLIA.chainName,
                nativeCurrency: ARBITRUM_SEPOLIA.nativeCurrency,
                rpcUrls: ARBITRUM_SEPOLIA.rpcUrls,
                blockExplorerUrls: ARBITRUM_SEPOLIA.blockExplorerUrls,
              }],
            });
          } else {
            throw err;
          }
        }
      }
      setProvider(browserProvider);
      setAccount(accs[0]);
    } catch (e) {
      console.error(e);
      alert("Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  function handleRunSignal(algo) {
    setRunAlgo(algo)
    setRunAppAddress(algo?.authorizedApp || "")
    setRunDpKey("file-key")
    setRunSchema("file")
    setRunStatus("")
    setRunError("")
    setRunTaskId("")
    setRunDealId("")
    setRunResultPreview("")
    setRunStepsCount(1)
    setRunSteps([""])
    setRunResultPath("")
    if (runResultUrl) {
      try { URL.revokeObjectURL(runResultUrl) } catch { }
      setRunResultUrl("")
    }
    setRunResultFilename("result.txt")
    setHasPaidForRun(false)
    setRunOpen(true)
  }

  async function handleRunIapp(e) {
    e.preventDefault()
    if (!dataProtectorCore) { alert("Please connect your wallet (Privy) first."); return }
    if (!runAlgo?.protectedAddress) { setRunError("This strategy does not include a protected data address."); return }
    if (!runAppAddress) { setRunError("Please provide the iApp address to run."); return }
    // Ensure payment is done once per run to avoid rate limiting
    if (!hasPaidForRun) {
      const ok = await handlePayEth(runAlgo)
      if (!ok) return
      setHasPaidForRun(true)
    }
    setRunError("")
    setRunStatus("Requesting wallet signature…")
    try {
      const stepsClean = (runSteps || []).map((s) => String(s || '').trim()).filter(Boolean)
      const args = stepsClean.length ? JSON.stringify({ steps: stepsClean }) : ""
      const res = await dataProtectorCore.processProtectedData({
        protectedData: runAlgo.protectedAddress,
        app: runAppAddress,
        args,
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
              if (parsed && typeof parsed === 'object' && 'fiability-score' in parsed) {
                const score = parsed['fiability-score']
                preview = `Fiability score: ${score}`
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

      const steps = []
      for (let i = 1; i <= numSteps; i++) {
        const stepValue = form[`step_${i}`]
        if (stepValue && stepValue.trim()) {
          steps.push(stepValue.trim())
        }
      }

      const privatePayload = {
        title: String(form.title || ""),
        asset: String(form.asset || ""),
        priceEth: Number(form.priceEth || 0.02),
        createdAt: new Date().toISOString(),
        owner: wallet?.address || "",
        steps: steps,
      }

      const encoder = new TextEncoder()
      const bytes = encoder.encode(JSON.stringify(privatePayload))
      // Include both a file payload and per-step string entries for broader compatibility
      const dataEntries = { "file-key": new Uint8Array(bytes), strategy_json: new Uint8Array(bytes) }
      steps.forEach((s, i) => {
        const key = `step${i + 1}`
        try { dataEntries[key] = String(s) } catch { }
      })

      const result = await dataProtectorCore.protectData({
        name: String(form.title || "strategy"),
        data: dataEntries,
      })

      const newAlgo = {
        id: `a${Date.now()}`,
        title: String(form.title),
        asset: String(form.asset),
        owner: String(result?.owner || wallet?.address || "you"),
        priceEth: Number(form.priceEth || 0.02),
        reviews: 0,
        protectedAddress: result.address,
        winRate: Math.round(Math.random() * 30 + 50),
        image: "/strategy-meeting.png",
      }

      setAlgos((prev) => [newAlgo, ...prev])
      setLastProtectedAddress(result.address)
    } catch (err) {
      console.error("Protect strategy failed:", err)
      alert("Failed to protect strategy. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGrantAccess(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!dataProtectorCore) {
      alert("Wallet/provider not ready. Connect with Privy first.");
      return;
    }
    if (!lastProtectedAddress) {
      alert("Protect your strategy first to get its address.");
      return;
    }
    try {
      setIsGrantingAccess(true);
      setGrantError("");
      setGrantStatus("Requesting wallet signature…");
      const price = Math.max(0, Math.trunc(Number(grantPricePerAccess) || 0));
      const volume = Math.max(1, Math.trunc(Number(grantNumberOfAccess) || 1));
      const res = await dataProtectorCore.grantAccess({
        protectedData: lastProtectedAddress,
        authorizedApp: grantAuthorizedApp,
        authorizedUser: grantAuthorizedUser || "0x0000000000000000000000000000000000000000",
        pricePerAccess: price,
        numberOfAccess: volume,
        onStatusUpdate: ({ title, isDone }) => {
          setGrantStatus(`${title}${isDone ? ' ✓' : ''}`);
          console.log(`Grant Access Status: ${title}, Done: ${isDone}`);
        },
      });
      setGrantResult(res);
      // attach authorized app to the listed strategy (if present)
      setAlgos((prev) => prev.map((a) => (
        a.protectedAddress === lastProtectedAddress ? { ...a, authorizedApp: grantAuthorizedApp } : a
      )));
      setGrantStatus("Access granted ✓");
    } catch (err) {
      console.error("Grant access failed:", err);
      setGrantError(err?.message || "Failed to grant access. Check inputs and try again.");
    } finally {
      setIsGrantingAccess(false);
    }
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
            <ShieldCheck size={24} style={{ color: "#7c3aed" }} />
            <span className="gradient-text">Strategy Market</span>
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
              Private trading signals for <span className="gradient-text">BTC</span> and{" "}
              <span className="gradient-text">ETH</span>
            </h1>
            <p className="hero-description">
              Pay per use in ETH, run inside iExec TEEs, receive a clean allocation signal. Strategies and inputs remain
              private.
            </p>
            <div className="hero-features">
              <div className="hero-feature">
                <Lock size={16} />
                Data protected
              </div>
              <div className="hero-feature">
                <Coins size={16} />
                ETH payments
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
                iExec Quickstart
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
          <div className="hero-card-wrapper" style={{ position: "relative" }}>
            <InteractiveSphere />
            <div className="hero-card" style={{ position: "relative", zIndex: 2 }}>
              <div className="hero-card-label">
                <Lock size={16} /> TEE enclave
              </div>
              <div className="hero-card-title">Execute privately, pay in ETH</div>
              <p className="hero-card-description">
                Monetize strategies without revealing code or data. On-chain receipts, auditable events, confidential
                compute with iExec.
              </p>
              <div className="hero-card-grid">
                {["ETH payments", "Access control", "Attestation"].map((k) => (
                  <div key={k} className="hero-card-item">
                    <div className="hero-card-item-title">{k}</div>
                    <div className="hero-card-item-subtitle">Ready to wire</div>
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
                onPay={() => handleRunSignal(algo)}
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
                  Pay
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
            onClick={() => { if (runResultUrl) { try { URL.revokeObjectURL(runResultUrl) } catch { } } setRunOpen(false); setRunResultUrl("") }}
          >
            <motion.div
              className="modal-sell"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 className="modal-title">Run iApp for “{runAlgo.title}”</h3>
                <button className="modal-close-button" onClick={() => { if (runResultUrl) { try { URL.revokeObjectURL(runResultUrl) } catch { } } setRunOpen(false); setRunResultUrl("") }}>
                  <X size={20} style={{ color: "#94a3b8" }} />
                </button>
              </div>

              {!runAlgo.protectedAddress ? (
                <div className="success-message" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
                  This listing has no protected data address. Ask the seller to protect and grant access.
                </div>
              ) : (
                <form onSubmit={handleRunIapp} className="modal-form">
                  <div className="form-group">
                    <label className="form-label">iApp address</label>
                    <input value={runAppAddress} onChange={(e) => setRunAppAddress(e.target.value)} placeholder="0x... app address granted to read this PD" className="form-input" maxLength={42} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Number of Steps</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={runStepsCount}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(10, Number(e.target.value)))
                        setRunStepsCount(n)
                        setRunSteps((prev) => {
                          const next = [...(prev || [])]
                          if (n > next.length) { while (next.length < n) next.push("") }
                          else if (n < next.length) { next.length = n }
                          return next
                        })
                      }}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Steps</label>
                    <div className="form-steps">
                      {Array.from({ length: runStepsCount }).map((_, i) => (
                        <div key={i}>
                          <input
                            value={runSteps[i] || ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setRunSteps((prev) => { const nx = [...(prev || [])]; nx[i] = v; return nx })
                            }}
                            placeholder={`Step ${i + 1}`}
                            className="form-input"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="form-steps-note">These steps describe your comparison sequence. The iApp can compare them with the seller's protected steps to compute a similarity score.</p>
                  </div>
                  {/* If steps are empty, the run uses empty args automatically */}
                  <div className="form-actions">
                    <div className="text-xs text-zinc-500">{runStatus}</div>
                    <button type="submit" className="gradient-button">Run iApp</button>
                  </div>

                  {runError && (
                    <div className="success-message" style={{ background: '#fee2e2', borderColor: '#ef4444', color: '#991b1b' }}>{runError}</div>
                  )}
                  {(runTaskId || runDealId) && (
                    <div className="text-xs text-zinc-500" style={{ marginTop: 8 }}>
                      {runDealId && (<div>Deal: {runDealId}</div>)}
                      {runTaskId && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>Task: {runTaskId}</span>
                          <a
                            href={`https://explorer.iex.ec/${IEXEC_EXPLORER_SLUG}/task/${runTaskId}`}
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
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', maxHeight: 240, overflow: 'auto' }}>{runResultPreview || '(binary content)'}</pre>
                      <a href={runResultUrl} download={runResultFilename} className="gradient-button" style={{ display: 'inline-flex', marginTop: 8, textDecoration: 'none' }}>Download {runResultFilename}</a>
                    </div>
                  )}
                </form>
              )}
            </motion.div>
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
            onClick={() => setSellOpen(false)}
          >
            <motion.div
              className="modal-sell"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 className="modal-title">List your strategy</h3>
                <button className="modal-close-button" onClick={() => setSellOpen(false)}>
                  <X size={20} style={{ color: "#94a3b8" }} />
                </button>
              </div>
              <p className="modal-description">Describe your strategy. Encryption is handled by iExec DataProtector.</p>
              <form className="modal-form" onSubmit={handleSubmitAlgo}>
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
                      onChange={(e) => setNumSteps(Math.max(1, Math.min(10, Number(e.target.value))))}
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
                  <button type="button" className="glass-button" onClick={() => setSellOpen(false)}>
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
                    <h4 className="form-label" style={{ fontSize: 15, fontWeight: 700 }}>Grant access (optional)</h4>
                    <p className="text-sm text-zinc-600" style={{ marginTop: 6 }}>Authorize an iApp and set price and volume so buyers can run your strategy.</p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="form-label">Authorized iApp address</label>
                        <input value={grantAuthorizedApp} onChange={(e) => setGrantAuthorizedApp(e.target.value)} required maxLength={42} placeholder="0x... app address" className="form-input" />
                      </div>
                      <div className="form-grid-2">
                        <div>
                          <label className="form-label">Authorized user (optional)</label>
                          <input value={grantAuthorizedUser} onChange={(e) => setGrantAuthorizedUser(e.target.value)} maxLength={42} placeholder="0x0000... for any user" className="form-input" />
                        </div>
                        <div>
                          <label className="form-label">Number of accesses</label>
                          <input type="number" min={1} value={grantNumberOfAccess} onChange={(e) => setGrantNumberOfAccess(parseInt(e.target.value) || 1)} className="form-input" />
                        </div>
                      </div>
                      <div>
                        <label className="form-label">Price per access (nRLC)</label>
                        <input type="number" min={0} value={grantPricePerAccess} onChange={(e) => setGrantPricePerAccess(parseFloat(e.target.value) || 0)} className="form-input" placeholder="100000000 = 0.1 RLC" />
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-xs text-zinc-500">{grantStatus}</div>
                        <button type="button" onClick={handleGrantAccess} disabled={isGrantingAccess || !grantAuthorizedApp} className="gradient-button" style={{ padding: '8px 14px' }}>{isGrantingAccess ? 'Granting…' : 'Grant access'}</button>
                      </div>
                    </div>
                    {grantResult && (
                      <div className="mt-3 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-sm space-y-1">
                        <div><strong>Granted!</strong></div>
                        <div>Protected Data: <span className="font-mono break-all">{grantResult.dataset}</span></div>
                        <div>Price: {grantResult.datasetprice} nRLC • Volume: {grantResult.volume}</div>
                        <div>iApp restrict: {String(grantResult.apprestrict)}</div>
                      </div>
                    )}
                    {grantError && (
                      <div className="mt-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-sm">{grantError}</div>
                    )}
                  </div>
                )}
              </form>
            </motion.div>
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
