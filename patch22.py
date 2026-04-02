content = open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', encoding='utf-8').read()

# 1. Fix types - hanya graduated
content = content.replace(
    'type BagsSubTab  = "new" | "bonding" | "migrated";',
    'type BagsSubTab  = "migrated";'
)
content = content.replace(
    'type PumpTab     = "new" | "bonding" | "graduated";',
    'type PumpTab     = "graduated";'
)
content = content.replace(
    'type BonkTab     = "new" | "bonding" | "migrated";',
    'type BonkTab     = "migrated";'
)

# 2. Default state ke graduated/migrated
content = content.replace(
    'useState<BagsSubTab>("new")',
    'useState<BagsSubTab>("migrated")'
)
content = content.replace(
    'useState<PumpTab>("new")',
    'useState<PumpTab>("graduated")'
)
content = content.replace(
    'useState<BonkTab>("new")',
    'useState<BonkTab>("migrated")'
)

open(r'C:\XBAGS V1\src\pages\MarketPage.tsx', 'w', encoding='utf-8', newline='\n').write(content)
print('Types & defaults: Done')
