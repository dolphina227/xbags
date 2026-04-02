lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Fix Pump Graduated header (baris 1156-1159, index 1155-1158)
lines[1155] = '                    <div className="flex items-center gap-2 py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">\n'
lines[1156] = '                      <span className="w-6 text-center">#</span><span className="w-9" /><span className="flex-1">Token</span>\n'
lines[1157] = '                      <span className="w-20 text-right">Price</span><span className="w-16 text-right hidden sm:block">Change</span><span className="w-16 text-right hidden sm:block">Vol 24h</span><span className="w-16 text-right hidden sm:block">Liq</span><span className="w-16 text-right hidden md:block">MCap</span>\n'
lines[1158] = '                    </div>\n'

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done')
