lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Hapus Bags sub-tab selector (index 698-712, baris 699-713 termasuk baris kosong)
del lines[698:713]

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
