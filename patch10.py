import re

path = r'C:\XBAGS V1\src\components\feed\PostCard.tsx'
content = open(path, encoding='utf-8').read()

old = '''    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("username", username)
      .single()
      .then(({ data }) => { if (data?.avatar_url) setAvatar(data.avatar_url); });'''

new = '''    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setAvatar(data.avatar_url); });'''

if old in content:
    open(path, 'w', encoding='utf-8', newline='\n').write(content.replace(old, new))
    print('Done')
else:
    print('Pattern not found')
