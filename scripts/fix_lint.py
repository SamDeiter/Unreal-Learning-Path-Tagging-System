import os

helper_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\ingestion\gemini_helper.py"
gen_path = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\ingestion\path_generator.py"

with open(helper_path, "r", encoding="utf-8") as f:
    text = f.read()

# Fix generate_guidance docstring
text = text.replace(
    "            video_titles: Titles of videos found.\n",
    "            video_titles: Titles of videos found.\n            engine: The target engine context (default UE5).\n"
)

# Fix generate_step_summary docstring
text = text.replace(
    "            user_query: User's problem.\n",
    "            user_query: User's problem.\n            engine: The target engine context (default UE5).\n"
)

# Fix curate_learning_path docstring
text = text.replace(
    "            videos: List of video dicts with title, description, video_id, thumbnail_url.\n",
    "            videos: List of video dicts with title, description, video_id, thumbnail_url.\n            engine: The target engine context (default UE5).\n"
)

with open(helper_path, "w", encoding="utf-8") as f:
    f.write(text)

with open(gen_path, "r", encoding="utf-8") as f:
    text2 = f.read()

# Fix long line E501
text2 = text2.replace(
    '            search_query = f"UE5 {display_name}" # Used internally for searching tag logic if any but not tied to UX',
    '            # Used internally for searching tag logic if any but not tied to UX\n            search_query = f"UE5 {display_name}"'
)

# Fix generate_path docstring
text2 = text2.replace(
    '            query: User\'s problem statement (e.g., "UE5 packaging fails").\n',
    '            query: User\'s problem statement (e.g., "UE5 packaging fails").\n            engine: The target engine context (default UE5).\n'
)

with open(gen_path, "w", encoding="utf-8") as f:
    f.write(text2)

print("Fixed linting issues via Python script.")
