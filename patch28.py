lines = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').readlines()

# Baris 688: {tab.label} -> tambah </button> ); })} </div> yang hilang
# Lalu hapus baris 689-695 yang rusak (sisa Bags header)
lines[687] = '                  {tab.label}\n                </button>\n              );\n            })}\n          </div>\n'

# Hapus baris 689-697 (index 688-696) yang merupakan sisa rusak
del lines[688:697]

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done, lines:', len(lines))
