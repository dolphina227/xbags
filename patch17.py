lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Fix Pump Graduated row columns (index 1185-1187)
lines[1185] = '                          <div className="w-20 text-right"><span className="text-xs font-mono text-foreground">{formatPrice(token.priceUsd)}</span></div>\n'
lines[1186] = '                          <div className="w-16 text-right hidden sm:block"><span className="text-xs text-muted-foreground">{token.priceChange?.h24 != null ? <span className={token.priceChange.h24 >= 0 ? "text-success" : "text-destructive"}>{token.priceChange.h24 >= 0 ? "+" : ""}{token.priceChange.h24.toFixed(1)}%</span> : "—"}</span></div>\n'
lines[1187] = '                          <div className="w-16 text-right hidden sm:block"><span className="text-xs text-muted-foreground">{formatMcap(token.volume24h)}</span></div>\n'

# Insert liq + mcap after
lines.insert(1188, '                          <div className="w-16 text-right hidden sm:block"><span className="text-xs text-muted-foreground">{formatMcap(token.liquidity)}</span></div>\n')
lines.insert(1189, '                          <div className="w-16 text-right hidden md:block"><span className="text-xs text-muted-foreground">{formatMcap(token.marketCap || token.fdv)}</span></div>\n')

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
