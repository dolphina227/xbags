import { Buffer } from "buffer";

// Polyfill Buffer for Solana libraries
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer;
}
