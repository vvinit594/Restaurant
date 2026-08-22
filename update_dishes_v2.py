import re

file_path = r'c:\Users\Khushi\OneDrive\Desktop\Restaurant BUsiness\food-menu-scanner\src\App.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the rawDishes array and update each dish line to include the image field
# Pattern: { id: X, name: "...", price: Y, category: "..." },
pattern = r'(\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",\s*price:\s*(\d+),\s*category:\s*"([^"]+)"\s*\})'

def replace_func(match):
    full_match = match.group(1)
    id_val = match.group(2)
    dish_name = match.group(3)
    price = match.group(4)
    category = match.group(5)
    
    return f'{{ id: {id_val}, name: "{dish_name}", price: {price}, category: "{category}", image: getImageUrl("{category}", "{dish_name}") }}'

new_content = re.sub(pattern, replace_func, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

# Count replacements
count = len(re.findall(pattern, content))
print(f'Updated {count} dishes with image field and dish names')
