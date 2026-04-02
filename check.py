lines = open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', encoding='utf-8').readlines()

# Cek baris 16-24 (index 15-23)
for i in range(14, 25):
    print(f"{i+1}: {repr(lines[i])}")
