"""Google Drive OAuth Setup and Sync.

This script:
1. Authenticates with your Google account (Epic account works)
2. Lists shared drives you have access to
3. Gets video file metadata (duration, size)

Setup Steps:
1. Go to https://console.cloud.google.com/
2. Create or select a project
3. Enable "Google Drive API"
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Select "Desktop app" as application type
6. Download the JSON file and save as 'credentials.json' in this folder
7. Run this script - it will open a browser for you to sign in
"""

import os
import pickle
from pathlib import Path

try:
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
except ImportError:
    print("Installing required packages...")
    os.system("pip install google-auth-oauthlib google-api-python-client")
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

# Scopes needed for Drive access
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

# Paths
CREDENTIALS_FILE = Path('credentials.json')
TOKEN_FILE = Path('token.pickle')


def get_credentials():
    """Get or refresh OAuth credentials."""
    creds = None

    # Check for existing token
    if TOKEN_FILE.exists():
        with open(TOKEN_FILE, 'rb') as f:
            creds = pickle.load(f)

    # Refresh or get new credentials
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired token...")
            creds.refresh(Request())
        else:
            if not CREDENTIALS_FILE.exists():
                print("\n" + "="*60)
                print("SETUP REQUIRED")
                print("="*60)
                print("""
1. Go to https://console.cloud.google.com/
2. Create or select a project
3. Enable 'Google Drive API'
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Select 'Desktop app' as application type
6. Download the JSON and save as 'credentials.json' here
7. Run this script again
""")
                return None

            print("Opening browser for authentication...")
            flow = InstalledAppFlow.from_client_secrets_file(
                str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)

        # Save token for next time
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)
        print("Credentials saved!")

    return creds


def list_shared_drives(service):
    """List all shared drives the user has access to."""
    print("\n📁 Shared Drives:")

    results = service.drives().list(pageSize=50).execute()
    drives = results.get('drives', [])

    for drive in drives:
        print(f"  - {drive['name']} (ID: {drive['id']})")

    return drives


def find_video_folders(service, drive_id, folder_name="VIDEOS"):
    """Find video folders in a shared drive."""
    print(f"\n🔍 Searching for '{folder_name}' folder...")

    query = f"name contains '{folder_name}' and mimeType='application/vnd.google-apps.folder'"
    results = service.files().list(
        q=query,
        corpora='drive',
        driveId=drive_id,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
        fields="files(id, name, parents)"
    ).execute()

    folders = results.get('files', [])
    for folder in folders:
        print(f"  Found: {folder['name']} (ID: {folder['id']})")

    return folders


def get_video_files(service, folder_id, drive_id):
    """Get all video files in a folder (recursive)."""
    print("\n📹 Getting video files...")

    query = f"'{folder_id}' in parents and mimeType contains 'video/'"
    results = service.files().list(
        q=query,
        corpora='drive',
        driveId=drive_id,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
        fields="files(id, name, size, mimeType, videoMediaMetadata)",
        pageSize=100
    ).execute()

    files = results.get('files', [])
    print(f"  Found {len(files)} video files")

    return files


def main():
    print("="*60)
    print("GOOGLE DRIVE OAUTH SETUP")
    print("="*60)

    creds = get_credentials()
    if not creds:
        return

    # Build Drive service
    service = build('drive', 'v3', credentials=creds)
    print("✅ Connected to Google Drive!")

    # List shared drives
    drives = list_shared_drives(service)

    if not drives:
        print("\n⚠️ No shared drives found. Make sure your account has access.")
        return

    # Find video folders
    for drive in drives:
        if 'Training' in drive['name'] or 'ELT' in drive['name']:
            print(f"\n📂 Checking: {drive['name']}")
            find_video_folders(service, drive['id'])


if __name__ == "__main__":
    main()
