"""Gemini AI Helper for Learning Path Guidance.

Uses Google Gemini API to generate personalized guidance
based on the user's problem and the content found.
"""

import json
import os
import urllib.request
import urllib.parse
from dataclasses import dataclass
from typing import Optional


@dataclass
class PathGuidance:
    """AI-generated guidance for a learning path."""

    problem_summary: str
    what_you_will_learn: list[str]
    estimated_time: str
    difficulty_level: str
    first_step_hint: str


class GeminiHelper:
    """Uses Gemini AI to generate helpful guidance."""

    API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

    def __init__(self):
        """Initialize with API key from environment."""
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    def is_available(self) -> bool:
        """Check if Gemini API is available."""
        return bool(self.api_key)

    def generate_guidance(
        self,
        user_query: str,
        tags: list[str],
        video_titles: list[str],
    ) -> Optional[PathGuidance]:
        """Generate personalized guidance for a learning path.

        Args:
            user_query: The user's problem statement.
            tags: Matched tags.
            video_titles: Titles of videos found.

        Returns:
            PathGuidance object or None if API unavailable.
        """
        if not self.is_available():
            return None

        prompt = f"""You are helping someone solve a UE5 (Unreal Engine 5) problem.

User's problem: "{user_query}"

Related topics: {', '.join(tags)}

Available videos:
{chr(10).join(f"- {t}" for t in video_titles[:5])}

Generate a helpful JSON response with these exact keys:
{{
  "problem_summary": "A 1-2 sentence explanation of what this problem is and why it happens",
  "what_you_will_learn": ["3-4 bullet points of what they'll learn"],
  "estimated_time": "How long this will take (e.g., '15-30 minutes')",
  "difficulty_level": "Beginner/Intermediate/Advanced",
  "first_step_hint": "A helpful tip for getting started"
}}

Be concise and encouraging. Focus on practical help."""

        try:
            data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 500,
                },
            }

            url = f"{self.API_URL}?key={self.api_key}"
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode())

            # Extract text from response
            text = result["candidates"][0]["content"]["parts"][0]["text"]

            # Parse JSON from response (handle markdown code blocks)
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            guidance_data = json.loads(text.strip())

            return PathGuidance(
                problem_summary=guidance_data.get("problem_summary", ""),
                what_you_will_learn=guidance_data.get("what_you_will_learn", []),
                estimated_time=guidance_data.get("estimated_time", "15-30 minutes"),
                difficulty_level=guidance_data.get("difficulty_level", "Intermediate"),
                first_step_hint=guidance_data.get("first_step_hint", ""),
            )

        except Exception as e:
            print(f"Gemini API error: {e}")
            return None

    def generate_step_summary(
        self,
        step_type: str,
        video_titles: list[str],
        user_query: str,
    ) -> Optional[str]:
        """Generate a brief summary for a specific step.

        Args:
            step_type: Type of step (foundations, diagnostics, etc.).
            video_titles: Video titles in this step.
            user_query: User's problem.

        Returns:
            Summary string or None.
        """
        if not self.is_available():
            return None

        step_context = {
            "foundations": "understanding the basics",
            "diagnostics": "diagnosing the problem",
            "resolution": "applying the fix",
            "prevention": "preventing future issues",
        }

        prompt = f"""For someone with this UE5 problem: "{user_query}"

These videos are about {step_context.get(step_type, step_type)}:
{chr(10).join(f"- {t}" for t in video_titles[:3])}

Write a single helpful sentence (under 100 chars) telling them what to look for in these videos.
Don't use quotes. Be specific and actionable."""

        try:
            data = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 100,
                },
            }

            url = f"{self.API_URL}?key={self.api_key}"
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=5) as response:
                result = json.loads(response.read().decode())

            return result["candidates"][0]["content"]["parts"][0]["text"].strip()

        except Exception as e:
            print(f"Gemini step summary error: {e}")
            return None


def main():
    """Test Gemini helper."""
    helper = GeminiHelper()

    if not helper.is_available():
        print("❌ Gemini API key not found. Set GEMINI_API_KEY or GOOGLE_API_KEY.")
        return

    print("🤖 Testing Gemini Helper...")

    guidance = helper.generate_guidance(
        user_query="UE5 packaging error ExitCode 25",
        tags=["build.packaging", "build.cooking"],
        video_titles=[
            "How to Fix UE5 Packaging Errors",
            "Understanding Cook Failures",
            "UE5 Build Pipeline Explained",
        ],
    )

    if guidance:
        print(f"\n📋 Problem: {guidance.problem_summary}")
        print(f"⏱️ Time: {guidance.estimated_time}")
        print(f"📊 Difficulty: {guidance.difficulty_level}")
        print(f"💡 Hint: {guidance.first_step_hint}")
        print(f"\n📚 You'll learn:")
        for item in guidance.what_you_will_learn:
            print(f"  • {item}")


if __name__ == "__main__":
    main()
