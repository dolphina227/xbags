export function getRpcUrl(network: 'mainnet-beta' | 'devnet' = 'mainnet-beta'): string {
  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY;

  if (heliusKey) {
    return network === 'devnet'
      ? `https://devnet.helius-rpc.com/?api-key=${heliusKey}`
      : `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }

  console.warn('VITE_HELIUS_API_KEY not found, using public RPC (rate-limited)');
  return network === 'devnet'
    ? 'https://api.devnet.solana.com'
    : 'https://api.mainnet-beta.solana.com';
}

export function getWssUrl(network: 'mainnet-beta' | 'devnet' = 'mainnet-beta'): string {
  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY;

  if (heliusKey) {
    return network === 'devnet'
      ? `wss://devnet.helius-rpc.com/?api-key=${heliusKey}`
      : `wss://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }

  return network === 'devnet'
    ? 'wss://api.devnet.solana.com'
    : 'wss://api.mainnet-beta.solana.com';
}

export function parseRpcError(error: any): {
  title: string;
  message: string;
  retryable: boolean;
} {
  const raw = JSON.stringify(error?.message || error || '').toLowerCase();
  const logs: string[] = error?.logs || error?.transactionError?.logs || error?.cause?.logs || [];
  const logStr = logs.join(' ').toLowerCase();

  const isInsufficientFunds =
    raw.includes('0x1') ||
    raw.includes('insufficient lamports') ||
    raw.includes('insufficient funds') ||
    raw.includes('insufficient sol') ||
    logStr.includes('insufficient lamports') ||
    logStr.includes('custom program error: 0x1') ||
    logStr.includes('transfer: insufficient');

  if (isInsufficientFunds) {
    return {
      title: 'Insufficient funds',
      message: 'Add tokens to cover the amount and fees, then try again.',
      retryable: false,
    };
  }

  if (raw.includes('simulation failed') || raw.includes('simulationfailed')) {
    return { title: 'Transaction failed', message: 'The transaction could not be simulated. Please try again.', retryable: true };
  }

  if (raw.includes('403') || raw.includes('access forbidden')) {
    return { title: 'Network busy', message: 'Try again in a few seconds.', retryable: true };
  }

  if (raw.includes('user rejected') || raw.includes('walletsigntransactionerror')) {
    return { title: 'Transaction cancelled', message: 'You cancelled the transaction.', retryable: false };
  }

  if (raw.includes('blockhash') || raw.includes('blockhashnotfound')) {
    return { title: 'Transaction expired', message: 'Please try again.', retryable: true };
  }

  if (raw.includes('timeout')) {
    return { title: 'Connection slow', message: 'Check your internet connection and try again.', retryable: true };
  }

  if (raw.includes('-32002')) {
    return { title: 'Transaction pending', message: 'Check Solscan to see if the transaction succeeded.', retryable: true };
  }

  return { title: 'Transaction failed', message: 'Something went wrong. Please try again.', retryable: true };
}
