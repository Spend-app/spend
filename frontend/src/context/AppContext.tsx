import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CONFIG, DEMO_ADDRESS, DEMO_WALLET } from '../data/mock'
import { sleep } from '../lib/format'

export interface Position {
  btc: number // exact BTC the user sent
  principal: number // MUSD
  startTime: number // ms
}

interface AppState {
  connected: boolean
  address: string
  musdBalance: number
  btcBalance: number
  approved: boolean
  position: Position | null
  paused: boolean
  connect: () => void
  disconnect: () => void
  approve: () => Promise<void>
  borrow: (amount: number, btcToSend: number) => Promise<void>
  repay: (totalOwed: number) => Promise<void>
  setPaused: (v: boolean) => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/**
 * Fake wallet + ledger. Every action just waits a moment and updates local state.
 * Swap these functions for real contract calls later.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [musdBalance, setMusdBalance] = useState(DEMO_WALLET.musd)
  const [btcBalance, setBtcBalance] = useState(DEMO_WALLET.btc)
  const [approved, setApproved] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [paused, setPausedState] = useState(false)

  const connect = useCallback(() => setConnected(true), [])
  const disconnect = useCallback(() => setConnected(false), [])

  const approve = useCallback(async () => {
    await sleep(1200)
    setApproved(true)
  }, [])

  const borrow = useCallback(async (amount: number, btcToSend: number) => {
    await sleep(1500)
    const fee = (amount * CONFIG.originationFeeBps) / 10_000
    setBtcBalance((b) => b - btcToSend)
    setMusdBalance((m) => m + amount - fee)
    setPosition({ btc: btcToSend, principal: amount, startTime: Date.now() })
  }, [])

  const repay = useCallback(
    async (totalOwed: number) => {
      await sleep(1500)
      if (!position) return
      setMusdBalance((m) => m - totalOwed)
      setBtcBalance((b) => b + position.btc)
      setPosition(null)
    },
    [position],
  )

  const setPaused = useCallback(async (v: boolean) => {
    await sleep(900)
    setPausedState(v)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      connected,
      address: DEMO_ADDRESS,
      musdBalance,
      btcBalance,
      approved,
      position,
      paused,
      connect,
      disconnect,
      approve,
      borrow,
      repay,
      setPaused,
    }),
    [connected, musdBalance, btcBalance, approved, position, paused, connect, disconnect, approve, borrow, repay, setPaused],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
