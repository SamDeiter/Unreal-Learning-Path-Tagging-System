"""
Fetch Google Trends data using pytrends (FREE - no API key needed)
This script is run by GitHub Actions weekly.
"""

import json
import os
import time
from datetime import datetime
from pytrends.request import TrendReq

# Keywords to track - UE5 related topics (keep list small to avoid rate limits)
KEYWORDS = ['unreal engine 5', 'metahuman', 'nanite']

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 60  # seconds

def fetch_trends():
    pytrends = TrendReq(hl='en-US', tz=360, retries=2, backoff_factor=0.5)
    
    insights = []
    
    for attempt in range(MAX_RETRIES):
        try:
            print(f"Attempt {attempt + 1}/{MAX_RETRIES}...")
            
            # Build payload for interest over time
            pytrends.build_payload(KEYWORDS, timeframe='today 3-m')
            
            # Get interest over time
            interest = pytrends.interest_over_time()
            
            if not interest.empty:
                for keyword in KEYWORDS:
                    if keyword in interest.columns:
                        recent = interest[keyword].tail(4).mean()
                        older = interest[keyword].head(8).mean()
                        
                        if older > 0:
                            change = ((recent - older) / older) * 100
                            
                            if change > 20:
                                insights.append({
                                    "type": "trends",
                                    "icon": "📈",
                                    "title": f"{keyword.title()} interest rising",
                                    "description": f"Search interest increased {change:.0f}% over the last 3 months.",
                                    "source": "Google Trends via pytrends",
                                    "priority": "high" if change > 50 else "medium"
                                })
                            elif change < -20:
                                insights.append({
                                    "type": "trends",
                                    "icon": "📉",
                                    "title": f"{keyword.title()} interest declining",
                                    "description": f"Search interest decreased {abs(change):.0f}% over the last 3 months.",
                                    "source": "Google Trends via pytrends",
                                    "priority": "low"
                                })
            
            # Success - break retry loop
            break
                
        except Exception as e:
            print(f"Error: {e}")
            if attempt < MAX_RETRIES - 1:
                print(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                insights.append({
                    "type": "trends",
                    "icon": "ℹ️",
                    "title": "Trends data unavailable",
                    "description": "Could not fetch Google Trends data. Will retry next week.",
                    "source": "System",
                    "priority": "low"
                })
    
    return insights

def main():
    print("📊 Fetching Google Trends data...")
    
    insights = fetch_trends()
    
    output_path = os.path.join(
        os.path.dirname(__file__), 
        '../path-builder/src/data/external_sources.json'
    )
    
    if os.path.exists(output_path):
        with open(output_path, 'r') as f:
            data = json.load(f)
    else:
        data = {"insights": [], "_meta": {}}
    
    data['_meta']['googleTrends'] = {
        'lastFetched': datetime.now().isoformat(),
        'keywordsTracked': KEYWORDS
    }
    
    data['insights'] = [i for i in data.get('insights', []) if i.get('type') != 'trends']
    data['insights'].extend(insights)
    
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✅ Wrote {len(insights)} trend insights to {output_path}")

if __name__ == '__main__':
    main()
