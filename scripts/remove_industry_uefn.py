import os
import re

file_path = r'c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src\components\UefnDemandDashboard\UefnDemandDashboard.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    orig_code = f.read()

code = orig_code

# Remove INDUSTRY_VERTICALS and colors
code = re.sub(r'// ── Industry Vertical Taxonomy.*?// ── Platform Tags', '// ── Platform Tags', code, flags=re.DOTALL)

# Remove _getIndustryVerticals and _getSubVerticalsForCategory (up to next section)
code = re.sub(r'/\*\* Get industry verticals for a given category.*?(?=\s*// ── Platform Badges)', '', code, flags=re.DOTALL)

# Remove industry badges
code = re.sub(r'\s*<div className="industry-badges-row">.*?</div>', '', code, flags=re.DOTALL)

# Remove IndustryBreakdownPanel component
code = re.sub(r'// ── Industry Breakdown Panel.*?// ── Platform Breakdown Panel', '// ── Platform Breakdown Panel', code, flags=re.DOTALL)

# Remove industryFilter states
code = re.sub(r'\s*const \[industryFilter, setIndustryFilter\] = useState\(null\);', '', code)
code = re.sub(r'\s*const \[subVerticalFilter, setSubVerticalFilter\] = useState\(null\);', '', code)

# Remove filtering logic block and replace with simpler searchFiltered mapping
filter_logic_pattern = r'\s*// Apply industry filter first, then sub-vertical, then platform filter.*?const finalSuggestions = platformFilter'
code = re.sub(filter_logic_pattern, '\n  const finalSuggestions = platformFilter', code, flags=re.DOTALL)
code = code.replace('? industryFiltered.filter((s)', '? searchFiltered.filter((s)')
code = code.replace(': industryFiltered;', ': searchFiltered;')

# Remove `<IndustryBreakdownPanel` usage
code = re.sub(r'\s*<IndustryBreakdownPanel[^>]*/>', '', code, flags=re.DOTALL)

# Remove `<div className="industry-filter-row">` rendering completely
code = re.sub(r'\s*<div className="industry-filter-row">.*?</div>', '', code, flags=re.DOTALL)

# Remove subVertical filtering section
code = re.sub(r'\s*\{industryFilter && INDUSTRY_VERTICALS.*?\}\)', '', code, flags=re.DOTALL)

if orig_code == code:
    print("NO CHANGES MADE.")
else:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("SUCCESS")
