# ─── Patch PostCard.tsx — tambah Super Like + upgrade Tip ke xBAGS ───────────
# Jalankan dari: C:\XBAGS V1\
# SAFE: hanya menambah import dan state baru, tidak menghapus yang sudah ada
# ─────────────────────────────────────────────────────────────────────────────

$file = "C:\XBAGS V1\src\components\feed\PostCard.tsx"
$content = Get-Content $file -Raw

# 1. Tambah import XBagsPayModal setelah import TipModal
$content = $content -replace `
  'import TipModal from "./TipModal";', `
  'import TipModal from "./TipModal";
import XBagsPayModal, { type PayMode } from "./XBagsPayModal";
import { Zap } from "lucide-react";'

# 2. Tambah state showXBagsModal dan payMode setelah state showTipModal
$content = $content -replace `
  'const \[showTipModal, setShowTipModal\] = useState\(false\);', `
  'const [showTipModal, setShowTipModal] = useState(false);
  const [showXBagsModal, setShowXBagsModal] = useState(false);
  const [xbagsPayMode, setXbagsPayMode] = useState<PayMode>("tip");'

# 3. Tambah Super Like button setelah Tip button
# Cari pattern: closing brace setelah Diamond button
$content = $content -replace `
  '(\{/\* Tip \*\/\}[\s\S]*?</button>\s*\)?\s*\}\s*\))', `
  '$1

                {/* Super Like */}
                {!isOwn && displayPost.author?.wallet_address && (
                  <button
                    onClick={() => { setXbagsPayMode("super_like"); setShowXBagsModal(true); }}
                    className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-xs"
                    title="Super Like with xBAGS"
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                )}'

# 4. Tambah XBagsPayModal setelah TipModal di JSX return
$content = $content -replace `
  '(\{showTipModal && displayPost\.author && \([\s\S]*?\)\})', `
  '$1

      {showXBagsModal && displayPost.author && (
        <XBagsPayModal
          isOpen={showXBagsModal}
          onClose={() => setShowXBagsModal(false)}
          mode={xbagsPayMode}
          recipientWallet={displayPost.author.wallet_address}
          recipientName={displayName}
          recipientUsername={displayPost.author.username}
          postIdForSuperLike={targetPostId}
          onSuperLiked={() => {}}
        />
      )}'

Set-Content $file $content -NoNewline
Write-Host "✅ PostCard.tsx patched"

# Verify
$check = Select-String -Path $file -Pattern "XBagsPayModal|showXBagsModal|super_like" 
Write-Host "Lines added:"
$check | Select-Object LineNumber, Line | Format-Table -AutoSize
