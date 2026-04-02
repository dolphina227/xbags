content = open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'r', encoding='utf-8').read()

old = '''                {/* Tip */}
                {!isOwn && displayPost.author?.wallet_address && (
                  <button onClick={() => setShowTipModal(true)} className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors text-xs">
                    <Diamond className="h-4 w-4" />
                  </button>
                )}'''

new = '''                {/* Tip */}
                {!isOwn && displayPost.author?.wallet_address && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors text-xs">
                        <Diamond className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px]">
                      <DropdownMenuItem onClick={() => setShowTipModal(true)}>
                        <Diamond className="h-4 w-4 mr-2" />Tip SOL
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setXbagsPayMode("tip"); setShowXBagsModal(true); }}>
                        <Zap className="h-4 w-4 mr-2" />Tip xBAGS
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}'''

result = content.replace(old, new)
if result == content:
    print('ERROR: pattern not found')
else:
    open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'w', encoding='utf-8', newline='\n').write(result)
    print('Done:', result.count('Tip xBAGS'), 'occurrences of Tip xBAGS')
