content = open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'r', encoding='utf-8').read()

content = content.replace(
    'import TipModal from "./TipModal";',
    'import TipModal from "./TipModal";\nimport XBagsPayModal, { type PayMode } from "./XBagsPayModal";'
)

content = content.replace(
    'const [showTipModal, setShowTipModal] = useState(false);',
    'const [showTipModal, setShowTipModal] = useState(false);\n  const [showXBagsModal, setShowXBagsModal] = useState(false);\n  const [xbagsPayMode, setXbagsPayMode] = useState<PayMode>("tip");'
)

old = '      {showTipModal && displayPost.author && (\n        <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} recipientWallet={displayPost.author.wallet_address} recipientName={displayName} recipientUsername={displayPost.author.username} />\n      )}'

new = old + '\n\n      {showXBagsModal && displayPost.author && (\n        <XBagsPayModal\n          isOpen={showXBagsModal}\n          onClose={() => setShowXBagsModal(false)}\n          mode={xbagsPayMode}\n          recipientWallet={displayPost.author.wallet_address}\n          recipientName={displayName}\n          recipientUsername={displayPost.author.username}\n          postIdForSuperLike={targetPostId}\n          onSuperLiked={() => {}}\n        />\n      )}'

content = content.replace(old, new)

open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'w', encoding='utf-8', newline='\n').write(content)
print('Done:', content.count('showXBagsModal'), 'occurrences of showXBagsModal')
