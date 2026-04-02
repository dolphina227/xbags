lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Hapus Bags sub-tab selector (baris 713-726, index 712-725)
# Hapus Pump sub-tab selector (baris 940-953, index 939-952)  
# Hapus Bonk sub-tab selector (baris 1222-1233, index 1221-1232)
# Harus hapus dari bawah ke atas agar index tidak bergeser

# 1. Bonk sub-tab (index 1221-1232)
del lines[1221:1233]

# 2. Pump sub-tab (index 939-952) - index sudah bergeser -12
del lines[927:940]

# 3. Bags sub-tab (index 712-725) - index sudah bergeser -24
del lines[688:702]

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
