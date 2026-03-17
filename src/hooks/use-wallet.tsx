import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useConnection, useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { toast } from "sonner";

export type NetworkType = "mainnet-beta" | "devnet";
export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WalletInfo {
  name: string;
  label: string;
  icon: string;
  installed: boolean;
  readyState: string;
}

interface WalletContextType {
  status: WalletStatus;
  address: string | null;
  publicKey: PublicKey | null;
  balance: number | null;
  balanceUsd: number | null;
  solPrice: number | null;
  network: NetworkType;
  showBalance: boolean;
  wallets: WalletInfo[];
  selectedWalletName: string | null;
  connect: (walletName: string) => Promise<void>;
  disconnect: () => void;
  copyAddress: () => void;
  toggleBalance: () => void;
  setNetwork: (network: NetworkType) => void;
  explorerUrl: string | null;
  solscanUrl: string | null;
  errorMessage: string | null;
  retryConnect: () => void;
  refreshBalance: () => Promise<void>;
  isRefreshing: boolean;
  sendTransaction: (to: string, amount: number) => Promise<string | null>;
  isSending: boolean;
}

const BALANCE_KEY = "bagsfun_show_balance";
const NETWORK_KEY = "bagsfun_network";
const SOL_PRICE_CACHE_KEY = "bagsfun_sol_price";

export function addressToColor(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

export function truncateAddress(address: string, start = 4, end = 4): string {
  if (!address) return "";
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

const WalletContext = createContext<WalletContextType | null>(null);

export function BagsFunWalletProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const {
    publicKey,
    connected,
    connecting,
    wallet,
    wallets: solanaWallets,
    select,
    disconnect: solanaDisconnect,
    sendTransaction: solanaSendTransaction,
  } = useSolanaWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(SOL_PRICE_CACHE_KEY);
      if (cached) {
        const { price, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 5 * 60 * 1000) return price;
      }
    } catch {}
    return null;
  });
  const [network, setNetworkState] = useState<NetworkType>(() => {
    return (localStorage.getItem(NETWORK_KEY) as NetworkType) || "mainnet-beta";
  });
  const [showBalance, setShowBalance] = useState(() => localStorage.getItem(BALANCE_KEY) !== "false");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAttemptedWallet, setLastAttemptedWallet] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [wasConnecting, setWasConnecting] = useState(false);
  const balanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track when connecting stops without becoming connected (= error/rejection)
  useEffect(() => {
    if (connecting) {
      setWasConnecting(true);
      setErrorMessage(null);
    } else if (wasConnecting && !connected) {
      // Was connecting but didn't connect — user rejected or error occurred
      setWasConnecting(false);
      setErrorMessage("Connection was rejected or failed.");
    } else if (connected) {
      setWasConnecting(false);
      setErrorMessage(null);
    }
  }, [connecting, connected]);

  // Derive status
  const status: WalletStatus = connecting
    ? "connecting"
    : connected && publicKey
    ? "connected"
    : errorMessage
    ? "error"
    : "disconnected";

  const address = publicKey?.toBase58() || null;

  // Fetch SOL price from CoinGecko
  const fetchSolPrice = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
      );
      if (!res.ok) return;
      const data = await res.json();
      const price = data.solana?.usd;
      if (price) {
        setSolPrice(price);
        localStorage.setItem(
          SOL_PRICE_CACHE_KEY,
          JSON.stringify({ price, timestamp: Date.now() })
        );
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch balance
  const refreshBalance = useCallback(async () => {
    if (!publicKey) return;
    setIsRefreshing(true);
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [publicKey, connection]);

  // Auto-fetch balance when connected
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalance();
      fetchSolPrice();

      balanceIntervalRef.current = setInterval(() => {
        refreshBalance();
      }, 30_000);

      const priceInterval = setInterval(fetchSolPrice, 5 * 60 * 1000);

      return () => {
        if (balanceIntervalRef.current) clearInterval(balanceIntervalRef.current);
        clearInterval(priceInterval);
      };
    } else {
      setBalance(null);
      if (balanceIntervalRef.current) clearInterval(balanceIntervalRef.current);
    }
  }, [connected, publicKey, refreshBalance, fetchSolPrice]);

  // Map Solana wallets to our WalletInfo format
  const wallets: WalletInfo[] = solanaWallets.map((w) => ({
    name: w.adapter.name,
    label: w.adapter.name,
    icon: w.adapter.icon,
    installed: w.readyState === "Installed",
    readyState: w.readyState,
  }));

  // If no wallets detected, show known wallets with install links
  const knownWallets: WalletInfo[] = wallets.length > 0 ? wallets : [
    {
      name: "Phantom",
      label: "Phantom",
      icon: "https://raw.githubusercontent.com/nicka/phantom-deeplink/refs/heads/master/public/phantom-icon.png",
      installed: false,
      readyState: "NotDetected",
    },
    {
      name: "Solflare",
      label: "Solflare",
      icon: "https://solflare.com/favicon.ico",
      installed: false,
      readyState: "NotDetected",
    },
    {
      name: "Backpack",
      label: "Backpack",
      icon: "https://backpack.app/favicon.ico",
      installed: false,
      readyState: "NotDetected",
    },
  ];

  const connect = useCallback(
    async (walletName: string) => {
      setLastAttemptedWallet(walletName);
      setErrorMessage(null);

      const w = solanaWallets.find((sw) => sw.adapter.name === walletName);
      if (!w || w.readyState !== "Installed") {
        const installUrls: Record<string, string> = {
          Phantom: "https://phantom.app/",
          Solflare: "https://solflare.com/",
          Backpack: "https://backpack.app/",
        };
        const url = installUrls[walletName] || `https://www.google.com/search?q=${walletName}+wallet`;
        setErrorMessage(`${walletName} is not installed.`);
        toast.error(`${walletName} not found`, {
          description: "Please install it from the official website.",
          action: {
            label: "Install",
            onClick: () => window.open(url, "_blank"),
          },
        });
        return;
      }

      // select() triggers the wallet adapter's connection flow
      // Errors are handled by the onError callback in SolanaWalletProvider
      // and by our wasConnecting state tracker above
      select(w.adapter.name);
    },
    [solanaWallets, select]
  );

  // Show toast on successful connection
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && wallet && !prevConnectedRef.current) {
      toast.success("Wallet connected!", {
        description: `Connected to ${wallet.adapter.name} on ${network === "mainnet-beta" ? "Mainnet" : "Devnet"}`,
      });
    }
    prevConnectedRef.current = connected;
  }, [connected, wallet?.adapter.name, network]);

  const disconnect = useCallback(() => {
    solanaDisconnect();
    setBalance(null);
    setErrorMessage(null);
    toast.info("Wallet disconnected");
  }, [solanaDisconnect]);

  const copyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard!");
    }
  }, [address]);

  const toggleBalance = useCallback(() => {
    setShowBalance((prev) => {
      const next = !prev;
      localStorage.setItem(BALANCE_KEY, String(next));
      return next;
    });
  }, []);

  const setNetwork = useCallback(
    (net: NetworkType) => {
      setNetworkState(net);
      localStorage.setItem(NETWORK_KEY, net);
      toast.info(`Switched to ${net === "mainnet-beta" ? "Mainnet" : "Devnet"}`);
    },
    []
  );

  const retryConnect = useCallback(() => {
    setErrorMessage(null);
    if (lastAttemptedWallet) connect(lastAttemptedWallet);
  }, [lastAttemptedWallet, connect]);

  const sendTransaction = useCallback(
    async (to: string, amount: number): Promise<string | null> => {
      if (!publicKey || !connected) {
        toast.error("Wallet not connected");
        return null;
      }
      if (!isValidSolanaAddress(to)) {
        toast.error("Invalid destination address");
        return null;
      }
      if (amount <= 0) {
        toast.error("Amount must be greater than 0");
        return null;
      }
      if (balance !== null && amount > balance) {
        toast.error("Insufficient balance");
        return null;
      }

      setIsSending(true);
      try {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(to),
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          })
        );

        const signature = await solanaSendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");

        toast.success("Transaction sent!", {
          description: `Signature: ${signature.slice(0, 8)}...`,
          action: {
            label: "View",
            onClick: () =>
              window.open(
                `https://solscan.io/tx/${signature}${network === "devnet" ? "?cluster=devnet" : ""}`,
                "_blank"
              ),
          },
        });

        setTimeout(refreshBalance, 2000);
        return signature;
      } catch (err: any) {
        const msg = err?.message || "Transaction failed";
        if (msg.includes("User rejected") || msg.includes("rejected the request")) {
          toast.error("Transaction cancelled", {
            description: "You rejected the transaction in your wallet.",
          });
        } else {
          toast.error("Transaction failed", { description: msg });
        }
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [publicKey, connected, balance, solanaSendTransaction, connection, network, refreshBalance]
  );

  const explorerUrl = address
    ? `https://explorer.solana.com/address/${address}${network === "devnet" ? "?cluster=devnet" : ""}`
    : null;

  const solscanUrl = address
    ? `https://solscan.io/account/${address}${network === "devnet" ? "?cluster=devnet" : ""}`
    : null;

  const balanceUsd = balance !== null && solPrice !== null ? balance * solPrice : null;

  return (
    <WalletContext.Provider
      value={{
        status,
        address,
        publicKey,
        balance,
        balanceUsd,
        solPrice,
        network,
        showBalance,
        wallets: knownWallets,
        selectedWalletName: wallet?.adapter.name || null,
        connect,
        disconnect,
        copyAddress,
        toggleBalance,
        setNetwork,
        explorerUrl,
        solscanUrl,
        errorMessage,
        retryConnect,
        refreshBalance,
        isRefreshing,
        sendTransaction,
        isSending,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within BagsFunWalletProvider");
  return ctx;
}

export { isValidSolanaAddress };
