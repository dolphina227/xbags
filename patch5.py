content = open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'r', encoding='utf-8').read()

old = '''                {/* Tip */}
                {!isOwn && displayPost.author?.wallet_address && ('''

new = '''                {/* Super Like */}
                {!isOwn && displayPost.author?.wallet_address && (
                  <button onClick={() => { setXbagsPayMode("super_like"); setShowXBagsModal(true); }} className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-xs">
                    <Zap className="h-4 w-4" />
                  </button>
                )}

                {/* Tip */}
                {!isOwn && displayPost.author?.wallet_address && ('''

result = content.replace(old, new)
if result == content:
    print('ERROR: pattern not found')
else:
    open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'w', encoding='utf-8', newline='\n').write(result)
    print('Done')
