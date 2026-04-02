lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Baris 1187 - fix change column (no nested JSX)
lines[1186] = '                          <div className="w-16 text-right hidden sm:block"><span className={`text-xs tabular-nums ${(token.priceChange?.h24 ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>{token.priceChange?.h24 != null ? `${token.priceChange.h24 >= 0 ? "+" : ""}${token.priceChange.h24.toFixed(1)}%` : "\u2014"}</span></div>\n'

# Baris 1191 - tambahkan </motion.div> yang hilang sebelum );
lines[1190] = '                          <div className="w-16 text-right hidden md:block"><span className="text-xs text-muted-foreground">{formatMcap(token.marketCap || token.fdv)}</span></div>\n'
lines.insert(1191, '                        </motion.div>\n')

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
