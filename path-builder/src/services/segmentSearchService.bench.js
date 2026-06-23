
import { describe, bench, vi } from 'vitest';
import { findTopSegments } from './segmentSearchService';

vi.mock('./dataLoader', () => {
  // Define data inside the mock to avoid hoisting issues
  const mockSegmentIndex = {
    "101": {
      videos: {}
    }
  };

  for (let v = 0; v < 5; v++) {
    const videoKey = `video_${v}`;
    mockSegmentIndex["101"].videos[videoKey] = {
      title: `Video Title ${v}`,
      segments: []
    };
    for (let s = 0; s < 50; s++) {
      mockSegmentIndex["101"].videos[videoKey].segments.push({
        text: `This is segment ${s} of video ${v}. It discusses Unreal Engine 5 features like Lumen global illumination, Nanite virtualized geometry, and various optimization techniques for real-time rendering. Sometimes we see flickering in shadows.`,
        start: `${Math.floor(s/6)}:${(s%6)*10}`,
        start_seconds: s * 10,
        end: `${Math.floor((s+1)/6)}:${((s+1)%6)*10}`
      });
    }
  }
  return {
    fetchJSON: vi.fn().mockResolvedValue(mockSegmentIndex)
  };
});

describe('findTopSegments performance', () => {
  bench('findTopSegments with 3 keywords', async () => {
    await findTopSegments("101", ["Lumen", "Nanite", "flickering"]);
  });
});
