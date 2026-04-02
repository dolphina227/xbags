lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Hapus baris 689-690 (index 688-689) yang merupakan sisa header rusak
del lines[688:690]

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
