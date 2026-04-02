lines = open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', 'r', encoding='utf-8').readlines()

new_block = (
'              ) : (\n'
'                <div className="space-y-3">\n'
'                  <div>\n'
'                    <p className="text-xs text-muted-foreground mb-2">Quick amounts</p>\n'
'                    <div className="grid grid-cols-4 gap-2">\n'
'                      {[50, 100, 500, 1000].map((qa) => (\n'
'                        <button key={qa} onClick={() => setAmount(qa)}\n'
'                          className={`py-2 rounded-lg text-xs font-semibold transition-all ${amount === qa ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>\n'
'                          {qa}\n'
'                        </button>\n'
'                      ))}\n'
'                    </div>\n'
'                  </div>\n'
'                  <div>\n'
'                    <p className="text-xs text-muted-foreground mb-1">Custom amount</p>\n'
'                    <div className="flex items-center gap-2">\n'
'                      <input type="number" value={amount}\n'
'                        onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}\n'
'                        className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"\n'
'                        min="1" />\n'
'                      <span className="text-sm font-semibold text-primary">xBAGS</span>\n'
'                    </div>\n'
'                    {xbagsPrice && (\n'
'                      <p className="text-xs text-muted-foreground mt-1">\n'
'                        approx ${(amount * xbagsPrice).toFixed(4)} USD\n'
'                      </p>\n'
'                    )}\n'
'                  </div>\n'
'                  <p className="text-xs text-muted-foreground text-center">\n'
'                    {mode === "super_like" ? "Sent directly to the creator" : "Unlock once, access forever"}\n'
'                  </p>\n'
'                </div>\n'
'              )}\n'
)

result = lines[:351] + [new_block] + lines[364:]
open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', 'w', encoding='utf-8', newline='\n').writelines(result)
print('Done, total lines:', len(result))
