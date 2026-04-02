content = open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', encoding='utf-8').read()

old = '''        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="text-yellow-400/80 flex items-center gap-1">
            <div className="h-1.5 w-0.5 bg-yellow-400/60 inline-block" />
            Softcap $5,000
            {isSoftcap && <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-1" />}
          </span>
          <span className={`font-semibold ${pctSold > 80 ? "text-orange-400" : "text-primary"}`}>
            {pctSold.toFixed(2)}% filled
          </span>
        </div>'''

new = '''        <div className="flex items-center justify-end text-xs text-muted-foreground font-mono">
          <span className={`font-semibold ${pctSold > 80 ? "text-orange-400" : "text-primary"}`}>
            {pctSold.toFixed(2)}% filled
          </span>
        </div>'''

if old in content:
    open(r'C:\XBAGS V1\src\pages\PresalePage.tsx', 'w', encoding='utf-8', newline='\n').write(content.replace(old, new))
    print('Done')
else:
    print('Pattern not found')
