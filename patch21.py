lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()
lines[1191] = '                       );\n                     })}\n'
open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done')
