content = open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', 'r', encoding='utf-8').read()

# Fix: ganti XBAGS_TOKEN_ADDRESS dengan import.meta.env.VITE_XBAGS_TOKEN_ADDRESS di useEffect harga
content = content.replace(
    '    if (!XBAGS_TOKEN_ADDRESS) return;\n    const apiKey = import.meta.env.VITE_HELIUS_API_KEY;',
    '    const tokenAddress = import.meta.env.VITE_XBAGS_TOKEN_ADDRESS;\n    if (!tokenAddress) return;\n    const apiKey = import.meta.env.VITE_HELIUS_API_KEY;'
)
content = content.replace(
    '        params: { id: XBAGS_TOKEN_ADDRESS },',
    '        params: { id: tokenAddress },'
)

open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', 'w', encoding='utf-8', newline='\n').write(content)
print('Done')
