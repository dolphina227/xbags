import sys

tail = """
              {/* Insufficient warning */}
              {insufficient && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  xBAGS balance is insufficient. Need to top up {amount.toLocaleString()} xBAGS.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  className={`flex-1 ${cfg.buttonColor}`}
                  disabled={sending || insufficient || !publicKey}
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                  ) : (
                    <>{cfg.icon}<span className="ml-1">{cfg.buttonLabel}</span></>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
"""

with open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', 'a', encoding='utf-8', newline='\n') as f:
    f.write(tail)

lines = open(r'C:\XBAGS V1\src\components\feed\XBagsPayModal.tsx', encoding='utf-8').readlines()
print('Total lines:', len(lines))
