// ============================================================
// Hardcoded Learning Path: "Set up an Unreal AI to patrol and chase the player"
// 8 Chapters, each with 3–4 steps (AI Transition, Video, Doc/RAG, Quiz)
// ============================================================

const PATH_DATA = {
  id: "path-ai-patrol",
  title: "Set up an Unreal AI to patrol and chase the player",
  metadata: {
    skillLevel: "Intermediate",
    estimatedHours: "5-15 Hours",
    industryFocus: "Games",
    engineVersion: "5.5",
    tags: ["AI", "<strong>State Tree</strong>", "<strong>NavMesh</strong>", "<strong>AI Perception</strong>"]
  },
  chapters: [
    // ── Chapter 1 ────────────────────────────────────────
    {
      id: "ch-1",
      number: 1,
      title: "Setting Up <strong>NavMesh Bounds Volume</strong>",
      description: "Define walkable areas for the AI agent within the level.",
      steps: [
        {
          id: "ch1-s1", type: "AI_TRANSITION",
          objectives: [
            "Understand what a <strong>NavMesh</strong> is and why AI needs it",
            "Learn how UE5 calculates walkable surfaces",
            "Place and size a <strong>NavMesh Bounds Volume</strong>"
          ],
          expectedOutcome: "Your level will have a green-shaded walkable area that AI agents can pathfind on."
        },
        {
          id: "ch1-s2", type: "CONTENT_VIDEO",
          title: "<strong>NavMesh</strong> Setup Tutorial",
          videoUrl: "https://www.youtube.com/embed/Ht1JkaG780o",
          whyThisMatters: "Without a <strong>NavMesh</strong>, AI characters have no concept of where they can walk. This is the absolute foundation  -  every AI behavior in UE5 depends on having a properly configured navigation mesh. Getting this right first prevents hours of debugging later.",
          keyTakeaways: [
            "Place a <strong>NavMesh Bounds Volume</strong> from the Volumes panel",
            "Scale it to cover your entire playable area",
            "Press P to visualize the green <strong>NavMesh</strong> overlay",
            "Rebuild paths after making level changes"
          ]
        },
        {
          id: "ch1-s3", type: "QUIZ",
          questions: [
            {
              text: "What does a <strong>NavMesh Bounds Volume</strong> define?",
              options: ["The area where the player can walk", "The area where AI can pathfind", "The collision boundaries of the level", "The rendering bounds of the level"],
              correctIndex: 1,
              explanation: "The <strong>NavMesh Bounds Volume</strong> defines the area where Unreal's navigation system generates walkable data for AI pathfinding."
            },
            {
              text: "How do you visualize the <strong>NavMesh</strong> in the editor?",
              options: ["Press N", "Press P", "Press M", "View > Show <strong>NavMesh</strong>"],
              correctIndex: 1,
              explanation: "Pressing 'P' toggles the <strong>NavMesh</strong> visualization, showing green areas where AI can walk."
            },
            {
              text: "What happens if you modify the level geometry after placing a <strong>NavMesh</strong>?",
              options: ["It updates automatically", "You need to rebuild navigation paths", "The <strong>NavMesh</strong> is deleted", "Nothing  -  geometry doesn't affect <strong>NavMesh</strong>"],
              correctIndex: 1,
              explanation: "After modifying geometry, you need to rebuild paths (Build > Build Paths) to update the walkable areas."
            },
            {
              text: "Where do you find the <strong>NavMesh Bounds Volume</strong>?",
              options: ["The Modes panel under Geometry", "The Volumes section in Place Actors", "The AI section in the toolbar", "Project Settings > Navigation"],
              correctIndex: 1,
              explanation: "<strong>NavMesh Bounds Volume</strong> is found in the Place Actors panel under the Volumes category."
            },
            {
              text: "Why is <strong>NavMesh</strong> the first step in AI setup?",
              options: ["It's alphabetically first", "AI controllers require it to compile", "AI needs walkable data before it can execute any movement", "It generates the AI character automatically"],
              correctIndex: 2,
              explanation: "Movement tasks like '<strong>Move To</strong>' rely on navigation data. Without a <strong>NavMesh</strong>, the AI has no pathfinding data and cannot move intelligently."
            }
          ]
        }
      ]
    },

    // ── Chapter 2 ────────────────────────────────────────
    {
      id: "ch-2",
      number: 2,
      title: "Creating the AI Character and <strong>Controller</strong>",
      description: "Build the base character blueprint and assign a specialized <strong>AI Controller</strong>.",
      steps: [
        {
          id: "ch2-s1", type: "AI_TRANSITION",
          objectives: [
            "Create a <strong>Character Blueprint</strong> for the AI enemy",
            "Understand the relationship between <strong>Pawns</strong> and Controllers",
            "Assign an <strong>AI Controller</strong> class to your character"
          ],
          expectedOutcome: "You'll have a standalone AI character in your level with its own <strong>AI Controller</strong> ready to receive behavior logic."
        },
        {
          id: "ch2-s2", type: "CONTENT_VIDEO",
          title: "AI Character & <strong>Controller</strong> Setup",
          videoUrl: "https://www.youtube.com/embed/Ht1JkaG780o",
          whyThisMatters: "In Unreal Engine, the <strong>Controller</strong> is the 'brain' and the <strong>Pawn</strong> is the 'body.' This separation is fundamental  -  it lets you swap brains (player vs AI) on the same body, or reuse the same brain across different body types. Understanding this architecture prevents a common beginner mistake: putting AI logic directly on the character.",
          keyTakeaways: [
            "Create a new <strong>Character Blueprint</strong> (not just an Actor)",
            "Add a Skeletal Mesh for visual representation",
            "Create an AIController Blueprint",
            "Set '<strong>AI Controller</strong> Class' in the character's defaults"
          ]
        },
        {
          id: "ch2-s3", type: "CONTENT_DOC",
          title: "<strong>State Tree</strong> Overview",
          content: "The <strong>AI Controller</strong> is the brain of your AI character. Unlike the Player <strong>Controller</strong> which receives input from a human, the <strong>AI Controller</strong> receives instructions from behavior systems like <strong>Behavior Trees</strong> or <strong>State Trees</strong>.\n\nWhen your AI Character is spawned into the world, Unreal automatically creates an instance of the assigned <strong>AI Controller</strong> class and 'possesses' the pawn.",
          relevantSnippet: "Navigate to your <strong>Character Blueprint</strong> → Class Defaults → <strong>AI Controller</strong> Class → Select your custom AIController.",
          codeBlock: "// In your <strong>AI Controller</strong>'s BeginPlay\nvoid AMyAIController::BeginPlay()\n{\n    Super::BeginPlay();\n    // The controller automatically possesses\n    // the pawn it's assigned to\n    UE_LOG(LogTemp, Log, TEXT(\"<strong>AI Controller</strong> active\"));\n}",
          aiNotes: [
            "Set '<strong>Auto Possess AI</strong>' to 'Placed in World or Spawned'",
            "Never put movement logic directly on the Character",
            "One <strong>Controller</strong> per <strong>Pawn</strong>  -  they are 1:1"
          ]
        },
        {
          id: "ch2-s4", type: "QUIZ",
          questions: [
            {
              text: "What is the relationship between a <strong>Controller</strong> and a <strong>Pawn</strong>?",
              options: ["They are the same thing", "The <strong>Controller</strong> is the 'brain', the <strong>Pawn</strong> is the 'body'", "The <strong>Pawn</strong> controls the <strong>Controller</strong>", "Controllers are only for player characters"],
              correctIndex: 1,
              explanation: "Controllers act as the decision-making 'brain' while <strong>Pawns</strong> are the physical 'body' in the world. This separation allows flexible AI architecture."
            },
            {
              text: "Why should you NOT put AI logic directly on the <strong>Character Blueprint</strong>?",
              options: ["It causes compile errors", "It violates the <strong>Controller</strong>-<strong>Pawn</strong> separation pattern, making code harder to maintain", "Characters can't run AI functions", "It's slower at runtime"],
              correctIndex: 1,
              explanation: "Putting AI logic on the Character breaks the <strong>Controller</strong>-<strong>Pawn</strong> architecture, making it impossible to swap behaviors or reuse characters."
            },
            {
              text: "What does '<strong>Auto Possess AI</strong>' control?",
              options: ["Whether the AI attacks automatically", "When the <strong>AI Controller</strong> takes control of the <strong>Pawn</strong>", "Whether the AI uses the <strong>NavMesh</strong>", "The AI's movement speed"],
              correctIndex: 1,
              explanation: "'<strong>Auto Possess AI</strong>' determines when the <strong>AI Controller</strong> automatically possesses (takes control of) the pawn  -  either when placed in the world, when spawned, or both."
            },
            {
              text: "Which Blueprint type should you use for an AI enemy?",
              options: ["Actor", "<strong>Pawn</strong>", "Character", "<strong>Controller</strong>"],
              correctIndex: 2,
              explanation: "Character Blueprints include a <strong>Character Movement Component</strong> which provides built-in walking, jumping, and <strong>NavMesh</strong>-based pathfinding."
            },
            {
              text: "How many Controllers can possess a single <strong>Pawn</strong> at once?",
              options: ["Unlimited", "Two  -  one AI and one Player", "One", "It depends on the <strong>Pawn</strong> type"],
              correctIndex: 2,
              explanation: "The relationship is strictly 1:1. Only one <strong>Controller</strong> can possess a <strong>Pawn</strong> at any given time."
            }
          ]
        }
      ]
    },

    // ── Chapter 3 ────────────────────────────────────────
    {
      id: "ch-3",
      number: 3,
      title: "Enabling and Creating a <strong>State Tree</strong>",
      description: "Activate and configure the <strong>State Tree</strong> system for AI decision-making.",
      steps: [
        {
          id: "ch3-s1", type: "AI_TRANSITION",
          objectives: [
            "Enable the <strong>State Tree</strong> plugin in Project Settings",
            "Understand how <strong>State Trees</strong> differ from <strong>Behavior Trees</strong>",
            "Create and assign a <strong>State Tree</strong> asset to your AI"
          ],
          expectedOutcome: "The <strong>State Tree</strong> plugin is active, you have a new <strong>State Tree</strong> asset, and it's assigned to your <strong>AI Controller</strong>  -  ready for states."
        },
        {
          id: "ch3-s2", type: "CONTENT_VIDEO",
          title: "<strong>State Tree</strong> Plugin & Setup",
          videoUrl: "https://www.youtube.com/embed/Ht1JkaG780o",
          whyThisMatters: "<strong>State Trees</strong> are Epic's modern replacement for <strong>Behavior Trees</strong>. They offer a cleaner, more visual approach to AI decision-making with built-in support for transitions, conditions, and evaluators. Learning <strong>State Trees</strong> now positions you for the future  -  Epic is actively developing them as the primary AI behavior system.",
          keyTakeaways: [
            "Enable '<strong>State Tree</strong>' and 'Gameplay <strong>State Tree</strong>' plugins",
            "Restart the editor after enabling plugins",
            "Create a <strong>State Tree</strong> via Right-Click > AI > <strong>State Tree</strong>",
            "Assign it in the <strong>AI Controller</strong>'s 'Run <strong>State Tree</strong>' component"
          ]
        },
        {
          id: "ch3-s3", type: "QUIZ",
          questions: [
            {
              text: "Where do you enable the <strong>State Tree</strong> plugin?",
              options: ["Project Settings > Plugins", "Edit > Plugins", "The Content Browser", "The <strong>AI Controller Blueprint</strong>"],
              correctIndex: 1,
              explanation: "Navigate to Edit > Plugins and search for '<strong>State Tree</strong>'. Enable both the <strong>State Tree</strong> and Gameplay <strong>State Tree</strong> plugins."
            },
            {
              text: "What must you do after enabling the plugin?",
              options: ["Rebuild the <strong>NavMesh</strong>", "Restart the editor", "Recompile all Blueprints", "Nothing  -  it's instant"],
              correctIndex: 1,
              explanation: "Plugin changes require an editor restart to take effect. You'll see a 'Restart Required' prompt."
            },
            {
              text: "How do <strong>State Trees</strong> differ from <strong>Behavior Trees</strong>?",
              options: ["They are identical", "<strong>State Trees</strong> use state-based logic with explicit transitions", "<strong>Behavior Trees</strong> are newer", "<strong>State Trees</strong> only work in C++"],
              correctIndex: 1,
              explanation: "<strong>State Trees</strong> use a state machine approach with explicit transitions between states, whereas <strong>Behavior Trees</strong> use a tree of tasks evaluated from root to leaf."
            },
            {
              text: "How do you create a new <strong>State Tree</strong> asset?",
              options: ["File > New", "Right-Click in Content Browser > AI > <strong>State Tree</strong>", "It's created automatically with the <strong>AI Controller</strong>", "Import from marketplace"],
              correctIndex: 1,
              explanation: "Right-Click in the Content Browser, navigate to the AI category, and select <strong>State Tree</strong> to create a new asset."
            },
            {
              text: "Where do you assign the <strong>State Tree</strong> to your AI?",
              options: ["On the <strong>Character Blueprint</strong> directly", "On the <strong>AI Controller</strong> via a <strong>State Tree Component</strong>", "In Project Settings", "In the <strong>State Tree</strong> asset itself"],
              correctIndex: 1,
              explanation: "Add a '<strong>State Tree Component</strong>' to your <strong>AI Controller Blueprint</strong> and set its '<strong>State Tree</strong>' property to your new <strong>State Tree</strong> asset."
            }
          ]
        }
      ]
    },

    // ── Chapter 4 ────────────────────────────────────────
    {
      id: "ch-4",
      number: 4,
      title: "Setting Up <strong>AI Perception</strong>",
      description: "Define the data flow and essential variables within the <strong>State Tree</strong>.",
      steps: [
        {
          id: "ch4-s1", type: "AI_TRANSITION",
          objectives: [
            "Add the <strong>AI Perception</strong> component to your <strong>AI Controller</strong>",
            "Configure the <strong>Sight</strong> sense with radius and angle",
            "Understand how <strong>AI Perception</strong> events fire"
          ],
          expectedOutcome: "Your AI can 'see' the player within a configurable radius and angle, and perception events are firing correctly."
        },
        {
          id: "ch4-s2", type: "CONTENT_VIDEO",
          title: "<strong>AI Perception</strong> Configuration",
          videoUrl: "https://www.youtube.com/embed/Ht1JkaG780o",
          whyThisMatters: "<strong>AI Perception</strong> is how your AI 'senses' the game world. Without it, the AI is blind  -  it can walk around but has no idea where the player is. The Perception system is event-driven, meaning it only notifies your AI when something changes (player enters sight, player leaves sight). This is far more efficient than checking every frame.",
          keyTakeaways: [
            "Add '<strong>AI Perception Component</strong>' to the <strong>AI Controller</strong>",
            "Configure a '<strong>Sight</strong>' sense with radius (~1500) and angle (~90°)",
            "Set the player's '<strong>AI Perception Stimuli Source</strong>' to generate stimuli",
            "Use '<strong>On Target Perception Updated</strong>' delegate for events"
          ]
        },
        {
          id: "ch4-s3", type: "QUIZ",
          questions: [
            {
              text: "Which component must be added to the <strong>AI Controller</strong> for the AI to detect the player?",
              options: ["<strong>NavMesh</strong> Component", "<strong>AI Perception Component</strong>", "<strong>Character Movement Component</strong>", "Scene Component"],
              correctIndex: 1,
              explanation: "The <strong>AI Perception Component</strong> handles all sensory input (sight, hearing, damage) for the <strong>AI Controller</strong>."
            },
            {
              text: "Why is event-driven perception better than checking every frame?",
              options: ["It's not  -  frame checks are better", "Events are more performant and only fire when something changes", "Events look better in Blueprints", "Frame checks aren't possible in UE5"],
              correctIndex: 1,
              explanation: "Event-driven perception avoids the CPU cost of checking distances every frame. It only fires callbacks when a stimulus enters, updates, or leaves the perception radius."
            },
            {
              text: "What must the player character have for AI to perceive it?",
              options: ["A <strong>NavMesh</strong> component", "An <strong>AI Perception Stimuli Source</strong> component", "An <strong>AI Controller</strong>", "A <strong>State Tree</strong>"],
              correctIndex: 1,
              explanation: "The player needs an '<strong>AI Perception Stimuli Source</strong>' component configured to generate stimuli (like being visible) that <strong>AI Perception</strong> can detect."
            },
            {
              text: "What defines how far the AI can see?",
              options: ["The <strong>NavMesh</strong> size", "The <strong>Sight</strong> Configuration's radius value", "The character's scale", "The level's fog settings"],
              correctIndex: 1,
              explanation: "The <strong>Sight</strong> sense configuration has a '<strong>Sight</strong> Radius' parameter that defines the maximum detection distance."
            },
            {
              text: "What event fires when the AI spots or loses sight of a target?",
              options: ["On Actor Overlap", "<strong>On Target Perception Updated</strong>", "On Component Hit", "On See Player"],
              correctIndex: 1,
              explanation: "'<strong>On Target Perception Updated</strong>' is the delegate that fires whenever the perception state of a target changes (spotted, lost, etc.)."
            }
          ]
        }
      ]
    },

    // ── Chapter 5 ────────────────────────────────────────
    {
      id: "ch-5",
      number: 5,
      title: "Configuring <strong>State Tree</strong> Parameters and <strong>Evaluators</strong>",
      description: "Map out AI behaviors and logic between patrol and chase states.",
      steps: [
        {
          id: "ch5-s1", type: "AI_TRANSITION",
          objectives: [
            "Add a parameter for tracking the target player",
            "Create an <strong>Evaluator</strong> that updates the target variable",
            "Understand how <strong>Evaluators</strong> run continuously in the background"
          ],
          expectedOutcome: "Your <strong>State Tree</strong> has a '<strong>TargetActor</strong>' parameter that automatically updates when the <strong>AI Perception</strong> system detects or loses the player."
        },
        {
          id: "ch5-s2", type: "CONTENT_RAG",
          title: "<strong>State Tree</strong> <strong>Evaluators</strong>",
          keyConcepts: [
            "<strong>Evaluators</strong> run every tick and can update <strong>State Tree</strong> parameters based on external data",
            "Parameters are typed variables accessible from any state in the tree",
            "The '<strong>AI Perception Evaluator</strong>' bridges the Perception system with <strong>State Tree</strong> parameters",
            "<strong>Evaluators</strong> are the 'sensors' of your <strong>State Tree</strong>  -  they observe the world and feed data into the decision system"
          ],
          commonMistakes: "A common mistake is trying to set <strong>State Tree</strong> parameters directly from the <strong>AI Controller Blueprint</strong>. Instead, use <strong>Evaluators</strong>  -  they're designed specifically for this purpose and run within the <strong>State Tree</strong>'s update cycle, ensuring data consistency.",
          tryItYourself: "Create a <strong>State Tree</strong> parameter called '<strong>TargetActor</strong>' of type Actor. Then add an <strong>Evaluator</strong> that uses <strong>AI Perception</strong> to populate this parameter whenever a hostile actor enters the AI's sight radius."
        },
        {
          id: "ch5-s3", type: "QUIZ",
          questions: [
            {
              text: "What is the role of an <strong>Evaluator</strong> in a <strong>State Tree</strong>?",
              options: ["It defines state transitions", "It runs tasks on the AI character", "It continuously updates parameters based on external data", "It handles animation blending"],
              correctIndex: 2,
              explanation: "<strong>Evaluators</strong> run every tick to read external data (like perception results) and write it into <strong>State Tree</strong> parameters that states and transitions can use."
            },
            {
              text: "What type should the '<strong>TargetActor</strong>' parameter be?",
              options: ["Boolean", "Vector", "Actor Object Reference", "String"],
              correctIndex: 2,
              explanation: "The <strong>TargetActor</strong> parameter needs to hold a reference to an Actor in the world, so it should be an Actor Object Reference."
            },
            {
              text: "When do <strong>Evaluators</strong> execute?",
              options: ["Only when a state changes", "Every tick (continuously)", "Only during transitions", "Only once at startup"],
              correctIndex: 1,
              explanation: "<strong>Evaluators</strong> tick continuously, running their logic every frame to keep parameters up to date with the game world."
            },
            {
              text: "Why shouldn't you set <strong>State Tree</strong> parameters directly from the <strong>AI Controller</strong>?",
              options: ["It's not technically possible", "It bypasses the <strong>State Tree</strong>'s update cycle, risking data inconsistency", "It's slower", "It causes compile errors"],
              correctIndex: 1,
              explanation: "Setting parameters outside the <strong>State Tree</strong>'s update loop can cause race conditions where states read stale data. <strong>Evaluators</strong> ensure synchronized updates."
            },
            {
              text: "What bridges <strong>AI Perception</strong> and the <strong>State Tree</strong>?",
              options: ["A custom event", "The <strong>AI Perception Evaluator</strong>", "The <strong>NavMesh</strong>", "The <strong>Character Blueprint</strong>"],
              correctIndex: 1,
              explanation: "The <strong>AI Perception Evaluator</strong> reads perception events and writes the results into <strong>State Tree</strong> parameters, creating a clean bridge between the two systems."
            }
          ]
        }
      ]
    },

    // ── Chapter 6 ────────────────────────────────────────
    {
      id: "ch-6",
      number: 6,
      title: "Building the Roam State",
      description: "Program AI movement between designated waypoints using <strong>State Tree</strong>.",
      steps: [
        {
          id: "ch6-s1", type: "AI_TRANSITION",
          objectives: [
            "Create a 'Roam' state in the <strong>State Tree</strong>",
            "Add a task that picks a random <strong>NavMesh</strong> point",
            "Add a second task that moves the AI to that point",
            "Set up the loop so the AI continuously roams"
          ],
          expectedOutcome: "Your AI wanders around the level randomly, picking new destinations on the <strong>NavMesh</strong> and walking to them in an endless loop."
        },
        {
          id: "ch6-s2", type: "CONTENT_VIDEO",
          title: "Building the Roam Behavior",
          videoUrl: "https://www.youtube.com/embed/Ht1JkaG780o",
          whyThisMatters: "The Roam state is your AI's 'idle' behavior  -  what it does when nothing interesting is happening. This teaches the core pattern of <strong>State Tree</strong> tasks: atomic units of work that execute in sequence. Once you understand how to chain 'Find Random Point' → '<strong>Move To</strong>', you can build any behavior by combining tasks.",
          keyTakeaways: [
            "Add a new State called 'Roam' to your <strong>State Tree</strong>",
            "Use the '<strong>Find Random Reachable Point</strong>' task to get a <strong>NavMesh</strong> location",
            "Chain a '<strong>Move To</strong>' task that walks the AI to that point",
            "Enable 'Enter Conditions' to loop the state when movement completes"
          ]
        },
        {
          id: "ch6-s3", type: "QUIZ",
          questions: [
            {
              text: "What does the '<strong>Find Random Reachable Point</strong>' task return?",
              options: ["A player reference", "A random location on the <strong>NavMesh</strong>", "A random rotation", "The nearest enemy"],
              correctIndex: 1,
              explanation: "This task queries the <strong>NavMesh</strong> and returns a random location that the AI can actually pathfind to."
            },
            {
              text: "What task makes the AI walk to a destination?",
              options: ["Set Actor Location", "<strong>Move To</strong>", "Add Movement Input", "Launch Character"],
              correctIndex: 1,
              explanation: "The '<strong>Move To</strong>' task uses the <strong>NavMesh</strong> to pathfind and move the AI character to a specified location."
            },
            {
              text: "How does the AI continuously roam without stopping?",
              options: ["A timer Blueprint", "The state re-enters itself when the <strong>Move To</strong> task succeeds", "An infinite loop node", "The player triggers it"],
              correctIndex: 1,
              explanation: "When the <strong>Move To</strong> task completes successfully, the state's completion triggers it to re-enter, picking a new random point and moving again."
            },
            {
              text: "Why must the random point be 'reachable'?",
              options: ["Unreachable points crash the game", "The AI could get stuck trying to pathfind to an impossible location", "It's just a naming convention", "All points on the <strong>NavMesh</strong> are reachable"],
              correctIndex: 1,
              explanation: "A reachable point is one the AI can actually pathfind to from its current location, avoiding situations where obstacles block the path."
            },
            {
              text: "What is the Roam state's role in the overall AI behavior?",
              options: ["It's the attack behavior", "It's the default/idle behavior when no threats are detected", "It only runs once at startup", "It handles player input"],
              correctIndex: 1,
              explanation: "Roam is the AI's baseline behavior  -  what it does when no player is detected. It keeps the AI looking 'alive' in the game world."
            }
          ]
        }
      ]
    },

    // ── Chapter 7 ────────────────────────────────────────
    {
      id: "ch-7",
      number: 7,
      title: "Building the Chase State",
      description: "Integrate perception and logic for switching to chasing behavior.",
      steps: [
        {
          id: "ch7-s1", type: "AI_TRANSITION",
          objectives: [
            "Create a 'Chase' state in the <strong>State Tree</strong>",
            "Use the <strong>TargetActor</strong> parameter to move toward the player",
            "Understand how the <strong>Move To</strong> task works with actor targets vs. locations"
          ],
          expectedOutcome: "When triggered, your AI directly chases the player's current position, updating its destination as the player moves."
        },
        {
          id: "ch7-s2", type: "CONTENT_VIDEO",
          title: "Chase State Implementation",
          videoUrl: "https://www.youtube.com/embed/Ht1JkaG780o",
          whyThisMatters: "The Chase state demonstrates a crucial concept: the difference between moving to a static point (Roam) and dynamically tracking a moving target (Chase). The '<strong>Move To</strong>' task behaves differently when given an Actor reference vs. a Vector  -  with an Actor, it continuously updates the destination. This is the pattern you'll use for any 'follow' or 'pursue' behavior.",
          keyTakeaways: [
            "Create a 'Chase' state alongside the existing 'Roam' state",
            "Use '<strong>Move To</strong>' with the <strong>TargetActor</strong> parameter (not a location)",
            "The AI automatically re-pathfinds as the target moves",
            "Set an 'Acceptable Radius' to stop the AI near (not on top of) the player"
          ]
        },
        {
          id: "ch7-s3", type: "QUIZ",
          questions: [
            {
              text: "What's the difference between <strong>Move To</strong> with a location vs. an Actor?",
              options: ["No difference", "Actor targets update dynamically as the target moves; locations are static", "Locations are faster", "Actor targets only work in C++"],
              correctIndex: 1,
              explanation: "When targeting an Actor, <strong>Move To</strong> continuously updates its destination as the actor moves. With a static Vector location, it walks to that one point and stops."
            },
            {
              text: "What parameter does the Chase state use to find the player?",
              options: ["PlayerIndex", "<strong>TargetActor</strong> (set by the <strong>Evaluator</strong>)", "A hardcoded player reference", "The nearest actor"],
              correctIndex: 1,
              explanation: "The Chase state reads the <strong>TargetActor</strong> parameter, which the <strong>Evaluator</strong> continuously updates based on <strong>AI Perception</strong> data."
            },
            {
              text: "What does 'Acceptable Radius' control?",
              options: ["The AI's vision range", "How close the AI gets before considering the <strong>Move To</strong> complete", "The collision radius", "The <strong>NavMesh</strong> generation radius"],
              correctIndex: 1,
              explanation: "Acceptable Radius defines how close the AI needs to get to the target before the <strong>Move To</strong> task reports success. Without it, the AI would try to stand exactly on the target."
            },
            {
              text: "Can the Roam and Chase states exist simultaneously?",
              options: ["Yes, they run in parallel", "No  -  the AI is in exactly one state at a time", "Only in C++", "Only with <strong>Behavior Trees</strong>"],
              correctIndex: 1,
              explanation: "In a <strong>State Tree</strong>, the AI is always in exactly one state. Transitions swap between states  -  you're either Roaming or Chasing, never both."
            },
            {
              text: "Why does the AI re-pathfind when chasing?",
              options: ["It's a bug", "Because <strong>Move To</strong> with an Actor target continuously recalculates the path", "The player sends position updates", "The <strong>NavMesh</strong> changes at runtime"],
              correctIndex: 1,
              explanation: "<strong>Move To</strong> with an Actor reference automatically recalculates the path at intervals as the target's position changes."
            }
          ]
        }
      ]
    },

    // ── Chapter 8 ────────────────────────────────────────
    {
      id: "ch-8",
      number: 8,
      title: "Adding State Transitions",
      description: "Run simulations, debug <strong>State Tree</strong> execution, and refine movement parameters.",
      steps: [
        {
          id: "ch8-s1", type: "AI_TRANSITION",
          objectives: [
            "Define transition conditions between Roam and Chase",
            "Use the <strong>TargetActor</strong> parameter to trigger transitions",
            "Test the full AI loop: Roam → See Player → Chase → Lose Player → Roam"
          ],
          expectedOutcome: "Your AI seamlessly transitions between roaming and chasing based on whether it can see the player. The full behavior loop is complete."
        },
        {
          id: "ch8-s2", type: "CONTENT_VIDEO",
          title: "State Transitions & Final Testing",
          videoUrl: "https://www.youtube.com/embed/Ht1JkaG780o",
          whyThisMatters: "Transitions are the glue that turns isolated states into intelligent behavior. The condition 'if <strong>TargetActor</strong> is valid → Chase, else → Roam' is the simplest form of reactive AI. This same pattern scales to complex systems  -  add more states (Attack, Flee, Investigate) and more conditions. The transition logic IS the AI's decision-making.",
          keyTakeaways: [
            "Add a transition from Roam → Chase: condition is '<strong>TargetActor</strong> Is Valid'",
            "Add a transition from Chase → Roam: condition is '<strong>TargetActor</strong> Is NOT Valid'",
            "Keep transition priorities in mind  -  higher-priority transitions are checked first",
            "Test by pressing Play and walking into/out of the AI's vision cone"
          ]
        },
        {
          id: "ch8-s3", type: "CONTENT_DOC",
          title: "Debugging <strong>State Trees</strong>",
          content: "<strong>State Trees</strong> have a built-in visual debugger that shows the active state, running tasks, and parameter values in real-time during <strong>Play-In-Editor</strong>.\n\nTo use it: open your <strong>State Tree</strong> asset, press Play in the editor, then select your AI character. The <strong>State Tree</strong> editor will highlight the currently active state in green and show evaluator outputs live.",
          relevantSnippet: "Use the <strong>State Tree</strong> debugger during PIE to watch transitions fire in real-time. Select the AI actor, then open the <strong>State Tree</strong> asset  -  active states highlight green.",
          codeBlock: "// Common debugging pattern  -  log state changes\nvoid UMyStateTreeTask::EnterState(\n    FStateTreeExecutionContext& Context)\n{\n    UE_LOG(LogTemp, Warning,\n        TEXT(\"Entering state: %s\"),\n        *GetNameSafe(this));\n}",
          aiNotes: [
            "Use Print String nodes in <strong>State Tree</strong> tasks for quick debugging",
            "Check the Output Log for transition messages",
            "Verify the <strong>TargetActor</strong> is being set by the <strong>Evaluator</strong> using the <strong>State Tree</strong> debugger"
          ]
        },
        {
          id: "ch8-s4", type: "QUIZ",
          questions: [
            {
              text: "What condition triggers the Roam → Chase transition?",
              options: ["A timer expires", "The player presses a button", "<strong>TargetActor</strong> becomes valid (AI sees the player)", "The AI reaches a waypoint"],
              correctIndex: 2,
              explanation: "When the <strong>Evaluator</strong> sets <strong>TargetActor</strong> to a valid actor (because <strong>AI Perception</strong> detected the player), the transition condition from Roam to Chase is satisfied."
            },
            {
              text: "What condition triggers Chase → Roam?",
              options: ["The player dies", "<strong>TargetActor</strong> becomes invalid (AI loses sight)", "A cooldown timer", "The AI reaches the player"],
              correctIndex: 1,
              explanation: "When the player leaves the AI's perception radius, the <strong>Evaluator</strong> clears <strong>TargetActor</strong>, making it invalid and triggering the transition back to Roam."
            },
            {
              text: "How do you debug which state the AI is currently in?",
              options: ["Check the console", "Open the <strong>State Tree</strong> asset during PIE  -  active states highlight green", "Add breakpoints to the <strong>Character Blueprint</strong>", "Use the <strong>NavMesh</strong> visualizer"],
              correctIndex: 1,
              explanation: "The <strong>State Tree</strong> visual debugger highlights the active state in green during <strong>Play-In-Editor</strong>, letting you watch transitions in real-time."
            },
            {
              text: "What is a transition priority?",
              options: ["How fast the transition happens", "The order in which conditions are evaluated  -  higher priority transitions are checked first", "The animation blend time", "How much CPU the transition uses"],
              correctIndex: 1,
              explanation: "When multiple transitions could fire simultaneously, priority determines which one is evaluated first. Higher-priority conditions take precedence."
            },
            {
              text: "You now have a complete AI behavior loop. What pattern does it follow?",
              options: ["Linear sequence", "Reactive state machine: Roam ↔ Chase based on perception", "Random behavior", "Scripted cutscene"],
              correctIndex: 1,
              explanation: "The AI follows a reactive state machine pattern  -  it reacts to perception events by transitioning between states, creating emergent behavior from simple rules."
            }
          ]
        }
      ]
    }
  ],

  // ── Path Completion Data ──────────────────────────────
  completion: {
    skillsMastered: ["<strong>NavMesh</strong>", "<strong>AI Controller</strong>", "<strong>State Trees</strong>", "<strong>AI Perception</strong>"],
    totalSteps: 26,
    totalHours: 6,
    suggestedNext: [
      {
        title: "Advanced AI Combat & EQS",
        description: "Set up an Unreal AI to patrol and chase the player",
        progress: 0
      },
      {
        title: "Creating Character Animations for AI",
        description: "Creating Character animations for AI l...",
        progress: 0
      }
    ]
  }
};
