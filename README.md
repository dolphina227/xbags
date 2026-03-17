# xbags — Social Trading Platform on Solana

> **Post. Get Tipped. Trade Fast.**xbags is a decentralized social trading platform built on Solana. It combines social media features (posts, feeds, messaging) with real-time token trading capabilities powered by [Bags.fm](https://bags.fm) and [DexScreener](https://dexscreener.com).

---

## 🏗 Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — database, auth, edge functions, realtime
- **Blockchain**: Solana (via `@solana/web3.js` + `@solana/wallet-adapter`)
- **RPC**: Helius (rate-limit-free Solana RPC)
- **Trading API**: Bags.fm Public API v2
- **Market Data**: DexScreener API

### Project Structure
```
src/
├── pages/              # Route pages
│   ├── LandingPage     # Welcome page with branding
│   ├── FeedPage        # Social feed (posts, likes, reposts)
│   ├── MarketPage      # Token market (3 tabs) + token detail
│   ├── MessagesPage    # DM with emoji & image support
│   ├── ProfilePage     # User profile
│   ├── WalletPage      # Wallet management
│   └── ...
├── components/
│   ├── layout/         # AppLayout, Sidebar, BottomNav, Header, RightSidebar
│   ├── feed/           # Post cards, comments, create post
│   ├── market/         # TokenDetail (chart + trade panel)
│   ├── wallet/         # WalletConnect, WalletDrawer, AddFunds, Withdraw
│   ├── sidebar/        # QuickBuyModal, TokenList
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom hooks (wallet, feed, messages, profile, notifications)
├── lib/                # Utilities, constants, Solana helpers
└── integrations/       # Supabase client & types (auto-generated)

supabase/functions/
├── fetch-tokens/       # Market data: New, Trending, All tabs
├── search-tokens/      # Token search (DexScreener + Bags.fm + Helius)
├── bags-trade/         # Quote & Swap via Bags.fm Trade API
└── publish-scheduled-posts/  # Scheduled post publisher
```

---

## 📊 Market System

### Three Tabs
| Tab | Data Source | Sort |
|-----|-----------|------|
| **New** | Bags.fm token-launch/feed → DexScreener enrich | `pairCreatedAt` DESC |
| **Trending** | Bags.fm feed → DexScreener enrich | `priceChange` DESC by timeframe |
| **All Tokens** | DexScreener token-boosts/top/v1 (Solana only) | `boostAmount` DESC |

### Timeframes
Each tab has independent timeframe selection: `5m`, `1h`, `6h`, `24h`
- **New & Trending**: Timeframe filters token age / sorts by matching price change
- **All**: Timeframe changes which `priceChange` column is displayed

### Caching
- **10s TTL** — won't re-fetch within 10 seconds
- **30s auto-refresh** — silent background refresh
- **500ms debounce** — prevents rapid re-fetching on tab/timeframe changes

### Token Detail View
When a token is clicked:
1. **DexScreener Chart** embedded via iframe (`embed=1&theme=dark`)
2. **Trade Panel** on the right with:
   - **Quick Trade** — preset Buy (0.1/0.5/1 SOL) and Sell (25/50/100%) buttons
   - **Custom Trade** — manual amount, slippage, priority fee inputs
   - **Settings** — editable presets, slippage, fee configuration
3. **External Links** — DexScreener, Solscan, Birdeye, Bags.fm, Holders

---

## 🔍 Search System

The search in the right sidebar finds both **users** and **tokens** simultaneously:

### User Search
- Queries the `profiles` table via `username` and `display_name` (case-insensitive)

### Token Search (`search-tokens` edge function)
1. **By Address** (CA paste): DexScreener `tokens/v1/solana/{address}` → Helius `getAsset` fallback
2. **By Name/Symbol**: DexScreener `/latest/dex/search` + Bags.fm feed matching
3. Clicking a token result navigates to `/market?token={address}` which opens the trading panel

---

## 💱 Trading System

### Flow: Quote → Sign → Send → Confirm
1. **Quote** — `bags-trade` edge function calls `GET /trade/quote` on Bags.fm API
2. **Pre-flight check** — Helius RPC checks wallet balance (SOL + fees)
3. **Swap** — `bags-trade` edge function calls `POST /trade/swap` → returns serialized transaction
4. **Sign** — User signs via wallet adapter (Phantom, Solflare, Backpack)
5. **Send** — `sendRawTransaction` to Solana
6. **Confirm** — `confirmTransaction` with blockhash

### Where Trading Exists
| Location | Component | Type |
|----------|-----------|------|
| Market → Token Detail | `TokenDetail.tsx` | Full trade panel (Quick + Custom + Settings) |
| Right Sidebar | `RightSidebar.tsx` | Quick Swap (paste CA + amount) |
| Market List → Click | `QuickBuyModal.tsx` | Quick Buy dialog |

### API Keys Required
| Key | Purpose | Storage |
|-----|---------|---------|
| `BAGS_API_KEY` | Bags.fm Trade API & token feed | Edge function secret |
| `VITE_HELIUS_API_KEY` | Solana RPC (balance, tx send) | Frontend env var |

---

## 👤 Social Features

### Feed
- Create posts (text + media)
- Like, comment, repost, quote
- Scheduled posts (published by `publish-scheduled-posts` edge function)
- Locked posts (unlock with SOL payment)
- View tracking

### Messaging
- Real-time DM conversations
- Emoji picker support
- Image attachments (URL detection + inline preview)

### Profiles
- Display name, username, bio, avatar, banner
- Follower/following counts
- Wallet address display

### Notifications
- Real-time notifications for likes, comments, follows, tips

---

## 👛 Wallet Integration

### Supported Wallets
- **Phantom** (primary)
- **Solflare**
- **Backpack**

### Features
- SOL balance display (auto-refresh every 30s)
- USD conversion via CoinGecko
- Send SOL to any address
- Network switching (Mainnet / Devnet)
- Wallet drawer with token holdings
- Add funds & withdraw modals

### Floating Action Button
- Green wallet button (56×56px) at bottom-right
- Opens drawer with balance, holdings, and quick actions

---

## 🗄 Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (display_name, username, avatar, wallet_address) |
| `posts` | Social posts with media, locked content, scheduled publishing |
| `post_likes` | Like tracking |
| `post_comments` | Comment threads |
| `post_reposts` | Reposts and quotes |
| `post_views` | View analytics |
| `post_unlocks` | SOL payment records for locked posts |
| `follows` | Follower/following relationships |
| `conversations` | DM conversation metadata |
| `messages` | Individual messages |
| `message_participants` | Conversation membership + unread counts |
| `notifications` | In-app notifications |

---

## 🚀 Development

```bash
npm install
npm run dev
```

### Environment Variables
- `VITE_SUPABASE_URL` — auto-configured
- `VITE_SUPABASE_PUBLISHABLE_KEY` — auto-configured
- `VITE_HELIUS_API_KEY` — Solana RPC access
- `BAGS_API_KEY` — Bags.fm API (edge function secret)

---

## 📱 Responsive Design

- **Desktop**: 3-column layout (sidebar + feed + right sidebar)
- **Mobile**: Single column with bottom navigation
- **Right Sidebar**: Only visible on desktop (`lg:` breakpoint), shown on feed & post detail pages
- **Bottom Nav**: Only visible on mobile with Home, Explore, Market, Messages, Profile

---

Built with ❤️ on Solana by the xbags team.
