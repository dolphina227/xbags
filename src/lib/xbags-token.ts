/**
 * src/lib/xbags-token.ts
 *
 * Config xBAGS token + helper SPL transfer.
 * Token address dibaca dari env: VITE_XBAGS_TOKEN_ADDRESS
 * Jika belum diset, semua fungsi gracefully fallback ke SOL.
 */

import {
  PublicKey,
  Transaction,
  Connection,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Address mint xBAGS token — diset via VITE_XBAGS_TOKEN_ADDRESS di .env */
export const XBAGS_TOKEN_ADDRESS: string | null =
  import.meta.env.VITE_XBAGS_TOKEN_ADDRESS || null;

/** Berapa decimal xBAGS token (standar SPL = 6) */
export const XBAGS_DECIMALS = 6;

/** Apakah token sudah diluncurkan dan siap dipakai */
export const XBAGS_TOKEN_LIVE = !!XBAGS_TOKEN_ADDRESS;

/** Harga fitur dalam xBAGS (akan diupdate setelah TGE) */
export const XBAGS_PRICES = {
  TIP_DEFAULT:   100,    // 100 xBAGS default tip
  SUPER_LIKE:    50,     // 50 xBAGS per super like
  UNLOCK_MIN:    10,     // minimum unlock price
} as const;

/** Quick tip amounts dalam xBAGS */
export const XBAGS_TIP_PRESETS = [50, 100, 500, 1000];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface XBagsTransferResult {
  signature: string;
  success: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Cek saldo xBAGS token milik wallet.
 * Return 0 jika token belum live atau ATA belum dibuat.
 */
export async function getXBagsBalance(
  connection: Connection,
  walletPubkey: PublicKey,
): Promise<number> {
  if (!XBAGS_TOKEN_ADDRESS) return 0;
  try {
    const mint = new PublicKey(XBAGS_TOKEN_ADDRESS);
    const ata  = await getAssociatedTokenAddress(mint, walletPubkey);
    const acct = await getAccount(connection, ata);
    return Number(acct.amount) / Math.pow(10, XBAGS_DECIMALS);
  } catch {
    return 0; // ATA belum ada = saldo 0
  }
}

/**
 * Buat Transaction untuk transfer xBAGS token dari sender ke recipient.
 * Otomatis membuat ATA recipient jika belum ada.
 * Throws jika token belum live.
 */
export async function buildXBagsTransferTx(
  connection: Connection,
  senderPubkey: PublicKey,
  recipientAddress: string,
  amount: number, // dalam xBAGS (bukan raw)
): Promise<Transaction> {
  if (!XBAGS_TOKEN_ADDRESS) {
    throw new Error("xBAGS token belum diluncurkan");
  }

  const mint      = new PublicKey(XBAGS_TOKEN_ADDRESS);
  const recipient = new PublicKey(recipientAddress);
  const rawAmount = Math.floor(amount * Math.pow(10, XBAGS_DECIMALS));

  const senderAta    = await getAssociatedTokenAddress(mint, senderPubkey);
  const recipientAta = await getAssociatedTokenAddress(mint, recipient);

  const tx = new Transaction();

  // Cek apakah ATA recipient sudah ada — kalau belum, buat dulu
  try {
    await getAccount(connection, recipientAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        senderPubkey,  // payer
        recipientAta,
        recipient,
        mint,
      )
    );
  }

  tx.add(
    createTransferInstruction(
      senderAta,
      recipientAta,
      senderPubkey,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID,
    )
  );

  return tx;
}