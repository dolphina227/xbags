lines = open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', encoding='utf-8').readlines()

lines[15] = 'const PRESALE_WALLET = "REPLACE_WITH_YOUR_TREASURY_WALLET"; // <- ganti wallet treasury\n'
lines[16] = 'const SOL_PER_XBAGS  = 1 / 20_000_000;    // 1 SOL = 20M XBAGS\n'
lines[17] = 'const XBAGS_PER_SOL  = 20_000_000;\n'
lines[18] = 'const MIN_SOL        = 0.1;\n'
lines[19] = 'const MAX_SOL        = 1;\n'
lines[20] = 'const HARDCAP_SOL    = 15;                 // 15 SOL hardcap\n'
lines[21] = 'const SOFTCAP_USD    = 500;                // softcap displayed\n'
lines[22] = 'const TOTAL_TOKENS   = 300_000_000;        // 15 SOL x 20M = 300M\n'

open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', 'w', encoding='utf-8', newline='\n').writelines(lines)
print('Done')
