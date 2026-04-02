lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Hapus dari bawah ke atas agar index tidak bergeser
# Bonk Almost Bonded: index 1284-1348
del lines[1284:1348]

# Bonk New: index 1237-1284 (sekarang index 1237-1284, belum bergeser karena hapus dari bawah)
del lines[1237:1284]

# Pump Almost Bonded: index 964-1066
del lines[964:1066]

# Pump New: index 901-964
del lines[901:964]

# Fix: tambah closing tags yang hilang setelah Pump header (index 899-900)
# Baris 900 sekarang adalah baris kosong, perlu tambah </div> refresh button closing
lines[899] = '                </div>\n'
lines.insert(900, '                <button onClick={() => { pumpCache.current.clear(); fetchPump(pumpTab); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"><RefreshCw className="h-3 w-3" /> Refresh</button>\n')
lines.insert(901, '              </div>\n')
lines.insert(902, '\n')

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
