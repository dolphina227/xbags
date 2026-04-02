content = open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', 'r', encoding='utf-8').read()

# 1. Tambah state xbagsPrice dan fetch harga via Helius
old = '  const [sending, setSending] = useState(false);\n  const [message, setMessage] = useState("");'
new = '''  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [xbagsPrice, setXbagsPrice] = useState<number | null>(null);

  // Fetch harga xBAGS dari Helius
  useEffect(() => {
    if (!XBAGS_TOKEN_ADDRESS) return;
    const apiKey = import.meta.env.VITE_HELIUS_API_KEY;
    if (!apiKey) return;
    fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: "xbags-price", method: "getAsset",
        params: { id: XBAGS_TOKEN_ADDRESS },
      }),
    })
      .then(r => r.json())
      .then(d => {
        const price = d?.result?.token_info?.price_info?.price_per_token;
        if (price && price > 0) setXbagsPrice(price);
      })
      .catch(() => {});
  }, []);'''

content = content.replace(old, new)

# 2. Ubah tampilan Super Like & Unlock agar bisa input manual + tampilkan USD
old = '''              <div className="text-center py-3">
                  <p className="text-4xl font-bold text-primary font-mono">
                    {amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">xBAGS</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {mode === "super_like"
                      ? "⚡ Dikirim langsung ke creator"
                      : "🔓 Unlock sekali, akses selamanya"}
                  </p>
                </div>'''

new = '''              <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Quick amounts</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[50, 100, 500, 1000].map((qa) => (
                        <button key={qa} onClick={() => setAmount(qa)}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all ${amount === qa ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                          {qa}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Custom amount</p>
                    <div className="flex items-center gap-2">
                      <input type="number" value={amount}
                        onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                        min="1" />
                      <span className="text-sm font-semibold text-primary">xBAGS</span>
                    </div>
                    {xbagsPrice && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ≈ ${(amount * xbagsPrice).toFixed(4)} USD
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {mode === "super_like" ? "⚡ Dikirim langsung ke creator" : "🔓 Unlock sekali, akses selamanya"}
                  </p>
                </div>'''

content = content.replace(old, new)

if 'xbagsPrice' in content:
    open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', 'w', encoding='utf-8', newline='\n').write(content)
    print('Done')
else:
    print('ERROR: pattern not found')
