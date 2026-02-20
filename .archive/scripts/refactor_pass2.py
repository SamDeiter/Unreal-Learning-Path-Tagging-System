"""Pass 2: Split narratorService.js
1. CHALLENGE_REGISTRY → data/challengeRegistry.json (static data)
2. generateChallenge() → services/challengeService.js (logic only)
3. narratorService.js keeps intro/bridge/progress only (~253 lines)
4. Update useGuidedPlayer.js import path.
"""
import json
import os

BASE = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src"

# ─── 1. Extract CHALLENGE_REGISTRY to JSON ───
registry = {
    "blueprint": [
        {
            "task": "Create a new Actor Blueprint (right-click Content Browser → Blueprint Class → Actor). Add a Point Light component and a Box Collision. In the Event Graph, wire 'On Component Begin Overlap' → 'Set Visibility' to toggle the light when the player walks through.",
            "hint": "Compile the Blueprint after wiring. Drop it in your level and hit Play to test the overlap.",
            "expectedResult": "When you walk into the collision box in Play mode, the Point Light should turn on/off. The Event Graph should show a connected chain from Overlap → Set Visibility with no compile errors."
        },
        {
            "task": "Open any existing Blueprint. Add a Custom Event called 'ResetState'. Wire it to set at least 2 variables back to their defaults, then call it from Begin Play with a 3-second Delay node.",
            "hint": "Right-click the Event Graph → Add Custom Event. Use a 'Delay' node (set Duration to 3.0) before the call.",
            "expectedResult": "After pressing Play, wait 3 seconds — the variables should snap back to their defaults. Print String nodes on each Set will confirm the reset fires. The Blueprint should compile without errors."
        }
    ],
    "materials": [
        {
            "task": "Create a new Material (right-click Content Browser → Material). Add a Texture Sample node for a Base Color map, plug a Constant3Vector into Emissive Color with a value like (1, 0.5, 0), and set Blend Mode to 'Masked'. Apply it to a cube in your scene.",
            "hint": "Double-click the Material to open the editor. Drag from output pins to input pins to connect nodes.",
            "expectedResult": "The cube should display your texture on its surface with an orange glow from the emissive channel. In 'Lit' mode, the emissive color should be visible even in shadow. The Material should show no errors in the Stats panel."
        },
        {
            "task": "Create a Material Instance from an existing Material (right-click → Create Material Instance). Expose at least 2 parameters (a color and a scalar), then adjust them on the instance to see the changes live in the viewport.",
            "hint": "In the parent Material, right-click a Constant → 'Convert to Parameter' and give it a name.",
            "expectedResult": "Changing the color slider on the Material Instance should immediately update the mesh's appearance in the viewport — no recompile needed. Both parameters should appear as editable fields in the Instance's Details panel."
        }
    ],
    "lighting": [
        {
            "task": "Build a small interior room with 4 walls and a ceiling (use BSP or cubes). Place a Rect Light (Add → Lights → Rect Light) inside, set its Source Width/Height to 200, Intensity to 15 cd, and color to warm white (4200K). Compare the result with a basic Point Light.",
            "hint": "Select the Rect Light → Details panel → Light section. Use 'Lit' viewport mode to see the final result.",
            "expectedResult": "The Rect Light should cast soft, directional shadows with a warm rectangular pool of light on the floor. Compared to the Point Light, the Rect Light shadows should be noticeably softer with more realistic falloff at the edges."
        },
        {
            "task": "Set up a three-point lighting rig: one Directional Light as key, one Rect Light as fill (half the intensity, opposite side), and one Spot Light as rim/backlight behind the subject. Screenshot the result.",
            "hint": "Key light: ~10 lux, Fill: ~5 lux, Rim: ~8 lux. Adjust the Directional Light's rotation in the Details panel.",
            "expectedResult": "Your subject should have a bright side (key), a dimly lit opposite side (fill) with soft shadows, and a bright edge outline on the back (rim). The overall look should feel cinematic with clear depth separation from the background."
        }
    ],
    "lumen": [
        {
            "task": "Go to Project Settings → Engine → Rendering → Global Illumination. Switch the method to Lumen. Place a colored Rect Light in a corner of a room and observe the indirect bounce light on nearby walls. Then try switching to 'Hardware Ray Tracing' under Lumen settings and compare.",
            "hint": "Use viewport Show → Visualize → Lumen Scene to debug. Software tracing works on any GPU; hardware RT needs RTX/RX 6000+.",
            "expectedResult": "Nearby white walls should pick up a tinted color from the Rect Light's bounce. Moving the light should update the indirect illumination within 1-2 seconds. Hardware RT mode should show sharper, more accurate bounces with less noise."
        },
        {
            "task": "Create a dark hallway with one open doorway letting in a Directional Light. With Lumen enabled, observe how light bleeds around the doorframe. Add an Emissive Material (Emissive value > 5) to a mesh inside and verify Lumen picks up the emission as a light source.",
            "hint": "Emissive lighting in Lumen needs Emissive values well above 1.0. Try 10-50 for visible bounce.",
            "expectedResult": "Light should visibly bleed around the doorframe edges into the dark hallway. The emissive mesh should cast soft colored light onto nearby surfaces — you'll see the floor and walls near it glow with the emissive color."
        }
    ],
    "animation": [
        {
            "task": "Open an Animation Blueprint for any Skeletal Mesh. In the Anim Graph, add a Blend Space 1D node. Create a new Blend Space asset (right-click Content Browser → Animation → Blend Space 1D), set the axis from 0-600 for 'Speed', and add Idle at 0 and Walk at 300.",
            "hint": "The X-axis parameter typically maps to a 'Speed' variable. Add sample points by right-clicking the graph area.",
            "expectedResult": "In the Blend Space preview, dragging the slider from 0 to 300 should smoothly transition from Idle to Walk. In Play mode, the character should blend between animations based on movement speed — standing still plays Idle, walking plays Walk."
        },
        {
            "task": "Create an Animation Montage from any animation (right-click anim → Create Montage). Add a Notify at the halfway point called 'FootstepSound'. In the Anim Blueprint's Event Graph, handle 'Anim Notify FootstepSound' to print a string.",
            "hint": "In the Montage timeline, right-click → Add Notify → New Notify. Name it exactly to match your handler.",
            "expectedResult": "When the montage plays and reaches the halfway mark, 'FootstepSound' should appear in the Output Log via Print String. The Notify marker should be visible as a triangle on the Montage timeline at the exact position you placed it."
        }
    ],
    "niagara": [
        {
            "task": "Create a new Niagara System (right-click Content Browser → FX → Niagara System → New System from Template → Fountain). Open it, find the 'Initialize Particle' module, and change the Lifetime from the default to a Min/Max of 1.0-3.0. Change the Sprite Size to 5-15. Drop it in your level.",
            "hint": "Expand modules by clicking the arrow. Each module has parameters you can override. Use the preview panel to see changes live.",
            "expectedResult": "Particles should now live longer (1-3 seconds instead of default), creating taller fountain arcs. The sprites should be visibly smaller (5-15 vs default). In the level viewport, you should see a continuous stream of small particles rising and falling."
        },
        {
            "task": "In an existing Niagara emitter, add a 'Curl Noise Force' module (click + in the Particle Update group → search 'Curl Noise'). Set Noise Strength to 200 and Frequency to 0.5. Observe how particles now swirl instead of falling straight.",
            "hint": "Curl Noise is under Particle Update → Forces. Increase Strength for more dramatic swirling.",
            "expectedResult": "Particles should visibly swirl and curl in organic patterns instead of falling straight down. At Strength 200 the effect should be dramatic — particles will loop and spiral. Reducing Frequency makes larger, lazier swirls."
        }
    ],
    "landscape": [
        {
            "task": "Enter Landscape Mode (Shift+3 or Modes panel → Landscape). Create a new landscape (Manage → New, 63×63 quads). Use the Sculpt tool to carve a river bed: flatten a path, then lower it with the Erosion tool. Paint a water material on the channel.",
            "hint": "Ctrl+scroll to resize brush. Flatten tool: hold Ctrl to sample target height first, then paint to level.",
            "expectedResult": "You should see a flat green landscape with a visibly sunken channel carved through it. The channel should have smooth, eroded edges (not sharp cuts). The water material should appear only on the painted channel area, distinct from the surrounding terrain."
        },
        {
            "task": "Add a Landscape Layer Blend material with 3 layers: Grass, Rock, and Sand. In Landscape Paint mode, paint each layer onto appropriate terrain areas. Add at least one auto-threshold rule based on slope angle.",
            "hint": "In the Material Editor, use a 'Landscape Layer Blend' node with 'LB Weight Blend' type. Each layer needs a Layer Info asset.",
            "expectedResult": "Steep slopes should auto-paint as Rock, flat areas as Grass, and your manually painted Sand should appear where you chose. Each layer should blend smoothly at boundaries — no hard seams between Grass and Rock transitions."
        }
    ],
    "mesh": [
        {
            "task": "Import a Static Mesh (drag an .fbx into the Content Browser). Open the Static Mesh Editor (double-click). Add a second LOD: Mesh → LOD Settings → set Number of LODs to 2 → click 'Apply Changes'. Set LOD1's screen size to 0.5.",
            "hint": "LOD0 is the highest detail. LOD1 kicks in when the mesh is smaller than 50% of the screen.",
            "expectedResult": "In the mesh editor, the LOD picker should show LOD0 and LOD1 with different triangle counts. In the viewport, zooming out past the 50% screen threshold should visibly switch to a simpler mesh version. Use 'r.StaticMeshLODDistanceScale 1' to verify."
        }
    ],
    "texture": [
        {
            "task": "Import a texture (drag a .png into Content Browser). Open it and change Compression Settings to 'BC7' for quality. Set the LOD Bias to 1 to test lower mip levels. Create a Material using this texture as Base Color and verify it renders in-scene.",
            "hint": "Texture Editor → Details → Compression → Compression Settings. Apply changes with 'Save'.",
            "expectedResult": "The texture should render clearly on the mesh with BC7 compression (minimal artifacts). With LOD Bias 1, the texture should appear slightly blurrier at distance (using a lower mip). The Material's Stats should show the texture memory size."
        }
    ],
    "character": [
        {
            "task": "Open your Character Blueprint. In the Details panel, find the Character Movement component. Set Max Walk Speed to 400, Jump Z Velocity to 600, and Air Control to 0.3. Test in Play mode — your character should now run faster and have more air steering.",
            "hint": "Character Movement is a component on your Character BP. All movement tuning is under 'Character Movement: Walking' and 'Jumping/Falling'.",
            "expectedResult": "In Play mode, your character should move noticeably faster than default (600 → 400). Jumping should feel floatier with higher arc (Z Velocity 600). While airborne, WASD should steer the character mid-jump thanks to Air Control 0.3."
        }
    ],
    "sequencer": [
        {
            "task": "Create a Level Sequence (Cinematics → Add Level Sequence). Add an actor track for a light in your scene. At frame 0, set intensity to 0. At frame 120, set intensity to 20. Play back the sequence and watch the light fade in over 4 seconds (at 30fps).",
            "hint": "Click + Track → Actor to Sequence → select the light. Right-click a property → 'Add Key' at the playhead position.",
            "expectedResult": "When you press Play in the Sequencer timeline, the light should gradually brighten from completely off to full intensity over exactly 4 seconds. The keyframe curve in the Sequencer should show a smooth ramp from 0 to 20. The scene should start dark and end lit."
        }
    ],
    "umg": [
        {
            "task": "Create a Widget Blueprint (right-click Content Browser → User Interface → Widget Blueprint). Add a Vertical Box with a Text block ('Health: 100') and a Progress Bar below it. In the Graph, bind the Progress Bar's Percent to a float variable called 'HealthPercent'.",
            "hint": "Select the Progress Bar → Details → Percent → click 'Bind' → Create Binding function that returns your HealthPercent variable.",
            "expectedResult": "In the Widget Designer preview, you should see 'Health: 100' text above a green progress bar. Changing the HealthPercent default value (0.0-1.0) should immediately update the bar fill. The binding icon next to Percent should show as linked (chain icon)."
        }
    ],
    "performance": [
        {
            "task": "Open your project and press ` (backtick) to open the console. Type 'stat fps' → Enter, then 'stat unit' → Enter. Walk around your scene and note where GPU ms spikes above 16ms. Use 'stat scenerendering' to find the most expensive render pass.",
            "hint": "stat unit shows Game, Draw, GPU, and RHIT thread times. The bottleneck is whichever thread has the highest ms value.",
            "expectedResult": "You should see an FPS counter in the top-left and a 4-bar breakdown (Game/Draw/GPU/RHIT). If any bar exceeds 16.6ms, that thread is your bottleneck. The scenerendering stats should highlight which pass (Base Pass, Shadows, Translucency) costs the most ms."
        }
    ],
    "nanite": [
        {
            "task": "Import a high-poly mesh (1M+ triangles). Enable Nanite on it: Static Mesh Editor → Nanite Settings → check 'Enable Nanite Support' → Apply. Place 50 instances in your scene using the Foliage tool and compare the frame rate with Nanite on vs. off using 'stat fps'.",
            "hint": "Nanite works best on Static Meshes without transparency. Use 'r.Nanite.Visualize.Overview 1' in console to see Nanite clusters.",
            "expectedResult": "With Nanite ON, 50 instances of a 1M-tri mesh should maintain near the same FPS as a single instance. With Nanite OFF, FPS should drop significantly. The Nanite visualization should show colored triangle clusters that change density based on distance."
        }
    ],
    "rendering": [
        {
            "task": "Open Project Settings → Engine → Rendering. Enable 'Virtual Shadow Maps'. Place a Directional Light, set it to Movable, and verify shadows render correctly. Compare the shadow quality at distance by zooming the camera far from objects.",
            "hint": "Virtual Shadow Maps replace Cascaded Shadow Maps. Check 'stat ShadowRendering' for performance impact.",
            "expectedResult": "Shadows should remain sharp and detailed even at far distances (unlike Cascaded Shadow Maps which get blurry). Close-up shadows should have clean edges without visible cascade boundaries. The stat overlay should show VSM memory and page usage."
        }
    ],
    "component": [
        {
            "task": "Open any Actor Blueprint. Add 3 components: a Static Mesh (as root), an Audio Component (attach a sound cue), and a Particle System. Arrange them in the component hierarchy so the particle and audio are children of the mesh. Test that moving the root moves everything.",
            "hint": "Drag components onto others in the hierarchy to parent them. Children inherit transform from their parent.",
            "expectedResult": "In the Blueprint viewport, all 3 components should be visible on the actor. Moving the root Static Mesh should move the particle and audio with it (they follow the parent). The hierarchy panel should show Audio and Particles indented under the mesh."
        }
    ],
    "actor": [
        {
            "task": "Right-click in the level viewport → Place Actor → Empty Actor. Add a Scene Component as root, then add a Static Mesh and a Spot Light as children. Position the Spot Light to illuminate the mesh. Save the actor as a Blueprint (select it → Blueprints → Convert Selection to Blueprint Class).",
            "hint": "Converting to a Blueprint lets you reuse this actor setup across levels. Choose 'Harvest Components' when prompted.",
            "expectedResult": "A new Blueprint asset should appear in your Content Browser. Dropping multiple instances into the level should each show the same mesh+light setup. The Spot Light cone should visibly illuminate the mesh in Lit viewport mode."
        }
    ],
    "foliage": [
        {
            "task": "Enter Foliage Mode (Shift+4). Add a tree or bush mesh to the foliage palette (drag from Content Browser). Set Density to 200, Min/Max Scale to 0.8-1.2, and enable 'Align to Normal'. Paint foliage on a Landscape surface and check the instance count in the Foliage panel.",
            "hint": "Use Erase (Shift+click) to remove foliage. Larger brush radius + lower density gives more natural distribution.",
            "expectedResult": "Trees/bushes should scatter naturally across the painted area with slight size variation (0.8x-1.2x). On slopes, they should tilt to match the terrain angle. The Foliage panel should show the total instance count increasing as you paint."
        }
    ],
    "plugin": [
        {
            "task": "Go to Edit → Plugins. Search for 'Water' (the built-in Water plugin). Enable it and restart the editor. After restart, place a Water Body Lake in your level (Place Actors → Water Body Lake) and observe how it auto-generates a water surface.",
            "hint": "Many built-in plugins are disabled by default. The Water plugin requires a Landscape in the level to function properly.",
            "expectedResult": "After restart, the Place Actors panel should list 'Water Body Lake'. Placing it should auto-generate a translucent water surface that conforms to your landscape. You should see reflections and shoreline foam where the water meets terrain."
        }
    ]
}

json_path = os.path.join(BASE, "data", "challengeRegistry.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(registry, f, indent=2)
print(f"✅ data/challengeRegistry.json created ({len(registry)} tag categories)")

# ─── 2. Create challengeService.js ───
challenge_service = r'''/**
 * Challenge Service — Generates hands-on challenges from the challenge registry.
 * Static challenge data lives in data/challengeRegistry.json.
 */
import challengeRegistry from "../data/challengeRegistry.json";

/**
 * Generate a hands-on challenge based on course metadata.
 * Uses tag-specific templates with concrete UE5 steps.
 *
 * @param {Object} course - current course object
 * @param {string} problemContext - the user's original problem summary
 * @param {string} videoTitle - title of the current video
 * @returns {{ task: string, hint: string, expectedResult: string, difficulty: string }}
 */
export function generateChallenge(course, problemContext, videoTitle) {
  // Collect tags from ALL available sources
  const tags = [
    ...(course?.canonical_tags || []),
    ...(course?.gemini_system_tags || []),
    ...(course?.transcript_tags || []),
    ...(course?.extracted_tags || []),
    ...(Array.isArray(course?.tags) ? course.tags : []),
  ];
  const tagNames = tags
    .map((t) => (typeof t === "string" ? t.split(".").pop() : t.name || t.display_name || ""))
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  const skillLevel = course?.gemini_skill_level || "Intermediate";

  // Try to match tags against the challenge registry (case-insensitive)
  for (const tagName of tagNames) {
    const key = tagName.toLowerCase();
    const templates = challengeRegistry[key];
    if (templates && templates.length > 0) {
      const titleHash = (course?.title || "")
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const template = templates[titleHash % templates.length];
      return {
        task: template.task,
        hint: template.hint,
        expectedResult: template.expectedResult,
        difficulty: skillLevel,
      };
    }
  }

  // Also check problem context for registry matches
  if (problemContext) {
    const contextLower = problemContext.toLowerCase();
    for (const [key, templates] of Object.entries(challengeRegistry)) {
      if (contextLower.includes(key)) {
        const template = templates[0];
        return {
          task: template.task,
          hint: template.hint,
          expectedResult: template.expectedResult,
          difficulty: skillLevel,
        };
      }
    }
  }

  // Fallback: still specific to UE5 even without a tag match
  const primaryTag =
    tagNames[0] || (videoTitle ? videoTitle.split(/\s+/).slice(0, 3).join(" ") : "this concept");
  const lessonRef = videoTitle ? `"${videoTitle}"` : "this lesson";
  const outcome = course?.gemini_outcomes?.[0] || "";

  return {
    task: problemContext
      ? `Open UE5 and apply the technique from ${lessonRef} to address "${problemContext}". In the Details panel, identify which ${primaryTag} settings you changed and note the before/after values.`
      : `Open UE5, create a test Actor, and set up ${primaryTag} from scratch following the approach from ${lessonRef}. Document which panels and properties you used.`,
    hint: outcome
      ? `Focus on: ${outcome}. Check Details panel and World Settings for relevant options.`
      : `Look for ${primaryTag} options in the Details panel, Modes panel, or Project Settings → Engine.`,
    expectedResult: problemContext
      ? `Your original issue ("${problemContext}") should be resolved or visibly improved in the viewport. Compare before/after values in the Details panel to confirm the change took effect.`
      : `You should see ${primaryTag} applied correctly in the viewport or preview. The Details panel should reflect the new settings, and the editor should show no warnings related to your changes.`,
    difficulty: skillLevel,
  };
}
'''

with open(os.path.join(BASE, "services", "challengeService.js"), "w", encoding="utf-8") as f:
    f.write(challenge_service)
print("✅ services/challengeService.js created")

# ─── 3. Slim narratorService.js — remove CHALLENGE_REGISTRY + generateChallenge ───
narrator_path = os.path.join(BASE, "services", "narratorService.js")
with open(narrator_path, encoding="utf-8") as f:
    content = f.read()

# Remove from the CHALLENGE_REGISTRY comment block through the end of generateChallenge
# Lines 255-535 (the challenge registry + generateChallenge function)
lines = content.split("\n")

# Find the start of the challenge section (line ~255-260)
cut_start = None
for i, line in enumerate(lines):
    if "Tag-specific challenge registry" in line:
        # Back up to the /** comment start
        j = i - 1
        while j >= 0 and lines[j].strip() == "":
            j -= 1
        while j >= 0 and not lines[j].strip().startswith("/**"):
            j -= 1
        cut_start = j
        break

if cut_start is None:
    # Try another marker
    for i, line in enumerate(lines):
        if "CHALLENGE_REGISTRY" in line and "const" in line:
            cut_start = i - 4  # Back up past the comment block
            break

if cut_start is not None:
    # Also remove the old generateChallenge export from the top if there's a re-export
    new_lines = lines[:cut_start]
    new_content = "\n".join(new_lines)
    with open(narrator_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"✅ narratorService.js trimmed: {len(lines)} → {len(new_lines)} lines")
else:
    print("⚠️ Could not find CHALLENGE_REGISTRY marker — manual trim needed")

# ─── 4. Update useGuidedPlayer.js to import from challengeService ───
hook_path = os.path.join(BASE, "hooks", "useGuidedPlayer.js")
with open(hook_path, encoding="utf-8") as f:
    hook_content = f.read()

# Replace the import
old_import = '''import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
  generateChallenge,
} from "../services/narratorService";'''

new_import = '''import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
} from "../services/narratorService";
import { generateChallenge } from "../services/challengeService";'''

if old_import in hook_content:
    hook_content = hook_content.replace(old_import, new_import)
    with open(hook_path, "w", encoding="utf-8") as f:
        f.write(hook_content)
    print("✅ hooks/useGuidedPlayer.js import updated")
else:
    print("⚠️ Could not find old import in useGuidedPlayer.js — check manually")

print("\n─── Pass 2 Complete ───")
