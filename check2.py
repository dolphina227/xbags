lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Cek area sekitar 1185-1192
for i in range(1183, 1195):
    print(f"{i+1}: {repr(lines[i])}")
