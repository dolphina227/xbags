lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Fix Pump header yang rusak (index 897-910) - ganti dengan header yang benar + hapus sub-tab
# Baris 897: <div> ... 898: Pump.fun ... 899-911: sub-tab selector rusak
new_pump_header = [
    '                  <div>\n',
    '                    <span className="text-sm font-bold text-foreground">Pump.fun</span>\n',
    '                    <span className="text-xs text-muted-foreground ml-2">Launchpad</span>\n',
    '                  </div>\n',
]
lines[896:911] = new_pump_header

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
