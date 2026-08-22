import re

file_path = r'c:\Users\Khushi\OneDrive\Desktop\Restaurant BUsiness\food-menu-scanner\src\App.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match each dish line
# Matches: { id: X, name: "...", price: Y, category: "...", image: getImageUrl("...") },
pattern = r'(\{\s*id:\s*\d+,\s*name:\s*"([^"]+)",\s*price:\s*\d+,\s*category:\s*"([^"]+)",\s*image:\s*)getImageUrl\("[^"]*"\)(\s*\})'

def replace_func(match):
    prefix = match.group(1)
    dish_name = match.group(2)
    category = match.group(3)
    suffix = match.group(4)
    return f'{prefix}getImageUrl("{category}", "{dish_name}"){suffix}'

new_content = re.sub(pattern, replace_func, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

# Count how many replacements were made
count = len(re.findall(pattern, content))
print(f'Updated {count} dishes')
