"""Quick test to see what's in the target folder."""
import pickle
from googleapiclient.discovery import build

# Load creds
with open('token.pickle', 'rb') as f:
    creds = pickle.load(f)
service = build('drive', 'v3', credentials=creds)

folder_id = '1gexT_hYjs87RWfgzOS4p1WszsweOFR6_'

print(f"📁 Listing contents of folder: {folder_id}")
print("=" * 60)

results = service.files().list(
    q=f"'{folder_id}' in parents",
    includeItemsFromAllDrives=True,
    supportsAllDrives=True,
    fields='files(id, name, mimeType)',
    pageSize=100
).execute()

folders = []
videos = []
for f in results.get('files', []):
    if 'folder' in f['mimeType']:
        folders.append(f)
    elif 'video' in f['mimeType']:
        videos.append(f)

print(f"\n📂 Subfolders ({len(folders)}):")
for f in folders[:15]:
    print(f"   {f['name']}")
if len(folders) > 15:
    print(f"   ... and {len(folders) - 15} more")

print(f"\n🎬 Videos ({len(videos)}):")
for v in videos[:10]:
    print(f"   {v['name']}")
if len(videos) > 10:
    print(f"   ... and {len(videos) - 10} more")
    
print(f"\n✅ Total: {len(folders)} folders, {len(videos)} videos")
