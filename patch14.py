lines = open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', encoding='utf-8').readlines()
# Hapus baris 530-606 (index 529-605)
result = lines[:529] + lines[606:]
open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', 'w', encoding='utf-8', newline='\n').writelines(result)
print('Done, total lines:', len(result))
