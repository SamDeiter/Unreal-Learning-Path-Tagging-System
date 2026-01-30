"""
Optimized Drive Video Sync

Extracts real video durations from Google Drive using:
- Parallel API calls (ThreadPoolExecutor with 32 workers)
- Batch requests to reduce API overhead
- Progress tracking

Run: python scripts/drive_sync_optimized.py
"""

import json
import pickle
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Config
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
TOKEN_FILE = Path('token.pickle')
CREDENTIALS_FILE = Path('credentials.json')
MAX_WORKERS = 32  # Parallel API calls
CONTENT_DIR = Path('content')
DATA_DIR = Path('path-builder/src/data')


class DriveVideoSync:
    def __init__(self):
        self.service = None
        self.video_data = {}
        self.lock = Lock()
        self.processed = 0
        self.total = 0
        
    def authenticate(self):
        """Load saved credentials or do new OAuth."""
        creds = None
        if TOKEN_FILE.exists():
            with open(TOKEN_FILE, 'rb') as f:
                creds = pickle.load(f)
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(CREDENTIALS_FILE), SCOPES)
                creds = flow.run_local_server(port=0)
            with open(TOKEN_FILE, 'wb') as f:
                pickle.dump(creds, f)
        
        self.service = build('drive', 'v3', credentials=creds)
        print("✅ Authenticated with Google Drive")
    
    def find_all_videos(self, folder_id: str = "1gexT_hYjs87RWfgzOS4p1WszsweOFR6_"):
        """Find all video files in a specific folder (recursively)."""
        print(f"\n🔍 Searching for videos in folder: {folder_id}...")
        
        all_videos = []
        folders_to_search = [folder_id]
        searched_folders = set()
        
        while folders_to_search:
            current_folder = folders_to_search.pop(0)
            if current_folder in searched_folders:
                continue
            searched_folders.add(current_folder)
            
            # Get videos in this folder
            query = f"'{current_folder}' in parents and mimeType contains 'video/'"
            try:
                results = self.service.files().list(
                    q=query,
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                    fields="files(id, name, size, videoMediaMetadata, parents)",
                    pageSize=1000
                ).execute()
                all_videos.extend(results.get('files', []))
            except Exception as e:
                print(f"   Error searching folder: {e}")
            
            # Get subfolders
            query = f"'{current_folder}' in parents and mimeType = 'application/vnd.google-apps.folder'"
            try:
                results = self.service.files().list(
                    q=query,
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                    fields="files(id, name)",
                    pageSize=1000
                ).execute()
                for folder in results.get('files', []):
                    folders_to_search.append(folder['id'])
            except Exception as e:
                pass
            
            if len(all_videos) % 100 == 0 and all_videos:
                print(f"   Found {len(all_videos)} videos so far...")
        
        print(f"✅ Found {len(all_videos)} total video files")
        return all_videos
    
    def get_video_metadata_batch(self, video_ids: list):
        """Get detailed metadata for a batch of videos."""
        results = {}
        
        def fetch_one(vid_id):
            try:
                meta = self.service.files().get(
                    fileId=vid_id,
                    fields="id,name,size,videoMediaMetadata,parents",
                    supportsAllDrives=True
                ).execute()
                
                # Extract duration in seconds
                video_meta = meta.get('videoMediaMetadata', {})
                duration_ms = video_meta.get('durationMillis', 0)
                
                return {
                    'id': vid_id,
                    'name': meta.get('name'),
                    'size_bytes': int(meta.get('size', 0)),
                    'duration_seconds': int(duration_ms) // 1000 if duration_ms else 0,
                    'parents': meta.get('parents', [])
                }
            except Exception as e:
                return {'id': vid_id, 'error': str(e)}
        
        # Parallel fetch
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(fetch_one, vid_id): vid_id for vid_id in video_ids}
            
            for future in as_completed(futures):
                result = future.result()
                with self.lock:
                    self.processed += 1
                    if self.processed % 100 == 0:
                        print(f"   Processed {self.processed}/{self.total} videos...")
                
                if 'error' not in result:
                    results[result['id']] = result
        
        return results
    
    def sync_durations_to_courses(self, video_metadata: dict):
        """Match Drive videos to course data and update durations."""
        print("\n📊 Matching videos to courses...")
        
        # Load current course data
        enriched_path = CONTENT_DIR / "video_library_enriched.json"
        data = json.loads(enriched_path.read_text())
        courses = data.get('courses', [])
        
        # Build name-to-metadata lookup
        name_lookup = {}
        for vid in video_metadata.values():
            name = vid.get('name', '').lower()
            if name:
                name_lookup[name] = vid
        
        updated_count = 0
        total_duration = 0
        
        for course in courses:
            # Try to match course videos
            videos = course.get('videos', [])
            course_duration = 0
            
            for video in videos:
                video_name = video.get('name', '').lower()
                # Try exact match
                if video_name in name_lookup:
                    meta = name_lookup[video_name]
                    course_duration += meta.get('duration_seconds', 0)
            
            if course_duration > 0:
                course['duration_minutes'] = course_duration // 60
                total_duration += course_duration
                updated_count += 1
        
        # Save updated data
        for p in [enriched_path, 
                  DATA_DIR / "video_library.json",
                  DATA_DIR / "video_library_enriched.json"]:
            p.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        
        hours = total_duration // 3600
        mins = (total_duration % 3600) // 60
        
        print(f"✅ Updated {updated_count} courses with real durations")
        print(f"📹 Total content: {hours} hours {mins} minutes")
    
    def run(self):
        """Main sync process."""
        print("=" * 60)
        print("GOOGLE DRIVE VIDEO SYNC (OPTIMIZED)")
        print(f"Using {MAX_WORKERS} parallel workers")
        print("=" * 60)
        
        start = time.time()
        
        # Authenticate
        self.authenticate()
        
        # Find all videos
        videos = self.find_all_videos()
        
        if videos:
            # Get detailed metadata in parallel
            video_ids = [v['id'] for v in videos]
            self.total = len(video_ids)
            
            print(f"\n⚡ Fetching metadata for {self.total} videos ({MAX_WORKERS} parallel)...")
            metadata = self.get_video_metadata_batch(video_ids)
            
            # Update course data
            self.sync_durations_to_courses(metadata)
            
            # Save raw metadata for reference
            raw_path = CONTENT_DIR / "drive_video_metadata.json"
            raw_path.write_text(json.dumps(list(metadata.values()), indent=2))
            print(f"💾 Saved raw metadata to {raw_path}")
        
        elapsed = time.time() - start
        print(f"\n⏱️  Completed in {elapsed:.1f} seconds")
        print("=" * 60)


if __name__ == "__main__":
    sync = DriveVideoSync()
    sync.run()
