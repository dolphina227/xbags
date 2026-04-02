content = open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', encoding='utf-8').read()

# Fix quick amounts - hapus 2 dan 5
content = content.replace(
    "{[0.1, 0.5, 1, 2, 5].map(v => (",
    "{[0.1, 0.5, 1].map(v => ("
)

open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', 'w', encoding='utf-8', newline='\n').write(content)
print('Quick amounts: Done')
