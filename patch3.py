content = open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'r', encoding='utf-8').read()

content = content.replace(
    'import { Heart, MessageCircle, Share2, Eye, MoreHorizontal,\n  Trash2, Diamond, Repeat2, Link2, ExternalLink,\n  TrendingUp, TrendingDown, Loader2, X, Copy, Users, Globe,\n} from "lucide-react";',
    'import { Heart, MessageCircle, Share2, Eye, MoreHorizontal,\n  Trash2, Diamond, Repeat2, Link2, ExternalLink,\n  TrendingUp, TrendingDown, Loader2, X, Copy, Users, Globe, Zap,\n} from "lucide-react";'
)

open(r'C:\XBAGS V1\src\components\feed\PostCard.tsx', 'w', encoding='utf-8', newline='\n').write(content)
print('Done:', content.count('Zap'))
