import { ReactNode, useMemo, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import type { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// ── IMPORT WALLET ADAPTERS (WAJIB UNTUK MOBILE) ──
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { SlopeWalletAdapter } from "@solana/wallet-adapter-slope";
import { LedgerWalletAdapter } from "@solana/wallet-adapter-ledger";

import { toast } from "sonner";
import { getRpcUrl } from "@/lib/solana-utils";

interface SolanaWalletProviderProps {
  children: ReactNode;
  network?: WalletAdapterNetwork;
}

const SolanaWalletProvider = ({
  children,
  network = "mainnet-beta" as WalletAdapterNetwork,
}: SolanaWalletProviderProps) => {
  const endpoint = useMemo(() => getRpcUrl(network as any), [network]);

  // ── DAFTAR WALLET YANG DIDUKUNG (FIX: TIDAK LAGI KOSONG) ──
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new SlopeWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [network]
  );

  const onError = useCallback((error: WalletError) => {
    const message = error.message || "Wallet error";
    if (
      message.includes("User rejected") ||
      message.includes("rejected the request") ||
      (error as any)?.error?.code === 4001
    ) {
      toast.error("Connection cancelled", {
        description: "You rejected the wallet connection request.",
      });
    } else if (message.includes("not found") || message.includes("not installed")) {
      toast.error("Wallet not found", {
        description: "Please install the wallet extension first.",
      });
    } else if (message.includes("Already processing")) {
      // Ignore - duplicate request
    } else {
      toast.error("Wallet error", {
        description: message,
      });
    }

    console.warn("[Wallet Error]", error.name, message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default SolanaWalletProvider;