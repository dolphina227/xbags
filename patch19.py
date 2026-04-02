lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Hapus duplikat baris 1191 (index 1190) dan fix indentasi })} di 1193 (index 1192)
del lines[1190]  # hapus duplikat mcap
# sekarang index bergeser, baris })} ada di index 1191
lines[1191] = '                     })}  \n'
# fix: pastikan indentasi benar
lines[1191] = '                    })}\n'

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
