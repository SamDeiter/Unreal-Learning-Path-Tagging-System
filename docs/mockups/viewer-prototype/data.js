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
      title: "Setting Up NavMesh Bounds Volume",
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
          title: "NavMesh Setup Tutorial",
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
              text: "What does a NavMesh Bounds Volume define?",
              options: ["The area where the player can walk", "The area where AI can pathfind", "The collision boundaries of the level", "The rendering bounds of the level"],
              correctIndex: 1,
              explanation: "The NavMesh Bounds Volume defines the area where Unreal's navigation system generates walkable data for AI pathfinding."
            },
            {
              text: "How do you visualize the NavMesh in the editor?",
              options: ["Press N", "Press P", "Press M", "View > Show NavMesh"],
              correctIndex: 1,
              explanation: "Pressing 'P' toggles the NavMesh visualization, showing green areas where AI can walk."
            },
            {
              text: "What happens if you modify the level geometry after placing a NavMesh?",
              options: ["It updates automatically", "You need to rebuild navigation paths", "The NavMesh is deleted", "Nothing  -  geometry doesn't affect NavMesh"],
              correctIndex: 1,
              explanation: "After modifying geometry, you need to rebuild paths (Build > Build Paths) to update the walkable areas."
            },
            {
              text: "Where do you find the NavMesh Bounds Volume?",
              options: ["The Modes panel under Geometry", "The Volumes section in Place Actors", "The AI section in the toolbar", "Project Settings > Navigation"],
              correctIndex: 1,
              explanation: "NavMesh Bounds Volume is found in the Place Actors panel under the Volumes category."
            },
            {
              text: "Why is NavMesh the first step in AI setup?",
              options: ["It's alphabetically first", "AI controllers require it to compile", "AI needs walkable data before it can execute any movement", "It generates the AI character automatically"],
              correctIndex: 2,
              explanation: "Movement tasks like 'Move To' rely on navigation data. Without a NavMesh, the AI has no pathfinding data and cannot move intelligently."
            }
          ]
        }
      ]
    },

    // ── Chapter 2 ────────────────────────────────────────
    {
      id: "ch-2",
      number: 2,
      title: "Creating the AI Character and Controller",
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
          title: "AI Character & Controller Setup",
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
          title: "State Tree Overview",
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
              text: "What is the relationship between a Controller and a Pawn?",
              options: ["They are the same thing", "The Controller is the 'brain', the Pawn is the 'body'", "The Pawn controls the Controller", "Controllers are only for player characters"],
              correctIndex: 1,
              explanation: "Controllers act as the decision-making 'brain' while Pawns are the physical 'body' in the world. This separation allows flexible AI architecture."
            },
            {
              text: "Why should you NOT put AI logic directly on the Character Blueprint?",
              options: ["It causes compile errors", "It violates the Controller-Pawn separation pattern, making code harder to maintain", "Characters can't run AI functions", "It's slower at runtime"],
              correctIndex: 1,
              explanation: "Putting AI logic on the Character breaks the Controller-Pawn architecture, making it impossible to swap behaviors or reuse characters."
            },
            {
              text: "What does 'Auto Possess AI' control?",
              options: ["Whether the AI attacks automatically", "When the AI Controller takes control of the Pawn", "Whether the AI uses the NavMesh", "The AI's movement speed"],
              correctIndex: 1,
              explanation: "'Auto Possess AI' determines when the AI Controller automatically possesses (takes control of) the pawn  -  either when placed in the world, when spawned, or both."
            },
            {
              text: "Which Blueprint type should you use for an AI enemy?",
              options: ["Actor", "Pawn", "Character", "Controller"],
              correctIndex: 2,
              explanation: "Character Blueprints include a Character Movement Component which provides built-in walking, jumping, and NavMesh-based pathfinding."
            },
            {
              text: "How many Controllers can possess a single Pawn at once?",
              options: ["Unlimited", "Two  -  one AI and one Player", "One", "It depends on the Pawn type"],
              correctIndex: 2,
              explanation: "The relationship is strictly 1:1. Only one Controller can possess a Pawn at any given time."
            }
          ]
        }
      ]
    },

    // ── Chapter 3 ────────────────────────────────────────
    {
      id: "ch-3",
      number: 3,
      title: "Enabling and Creating a State Tree",
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
          title: "State Tree Plugin & Setup",
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
              text: "Where do you enable the State Tree plugin?",
              options: ["Project Settings > Plugins", "Edit > Plugins", "The Content Browser", "The AI Controller Blueprint"],
              correctIndex: 1,
              explanation: "Navigate to Edit > Plugins and search for 'State Tree'. Enable both the State Tree and Gameplay State Tree plugins."
            },
            {
              text: "What must you do after enabling the plugin?",
              options: ["Rebuild the NavMesh", "Restart the editor", "Recompile all Blueprints", "Nothing  -  it's instant"],
              correctIndex: 1,
              explanation: "Plugin changes require an editor restart to take effect. You'll see a 'Restart Required' prompt."
            },
            {
              text: "How do State Trees differ from Behavior Trees?",
              options: ["They are identical", "State Trees use state-based logic with explicit transitions", "Behavior Trees are newer", "State Trees only work in C++"],
              correctIndex: 1,
              explanation: "State Trees use a state machine approach with explicit transitions between states, whereas Behavior Trees use a tree of tasks evaluated from root to leaf."
            },
            {
              text: "How do you create a new State Tree asset?",
              options: ["File > New", "Right-Click in Content Browser > AI > State Tree", "It's created automatically with the AI Controller", "Import from marketplace"],
              correctIndex: 1,
              explanation: "Right-Click in the Content Browser, navigate to the AI category, and select State Tree to create a new asset."
            },
            {
              text: "Where do you assign the State Tree to your AI?",
              options: ["On the Character Blueprint directly", "On the AI Controller via a State Tree Component", "In Project Settings", "In the State Tree asset itself"],
              correctIndex: 1,
              explanation: "Add a 'State Tree Component' to your AI Controller Blueprint and set its 'State Tree' property to your new State Tree asset."
            }
          ]
        }
      ]
    },

    // ── Chapter 4 ────────────────────────────────────────
    {
      id: "ch-4",
      number: 4,
      title: "Setting Up AI Perception",
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
          title: "AI Perception Configuration",
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
              text: "Which component must be added to the AI Controller for the AI to detect the player?",
              options: ["NavMesh Component", "AI Perception Component", "Character Movement Component", "Scene Component"],
              correctIndex: 1,
              explanation: "The AI Perception Component handles all sensory input (sight, hearing, damage) for the AI Controller."
            },
            {
              text: "Why is event-driven perception better than checking every frame?",
              options: ["It's not  -  frame checks are better", "Events are more performant and only fire when something changes", "Events look better in Blueprints", "Frame checks aren't possible in UE5"],
              correctIndex: 1,
              explanation: "Event-driven perception avoids the CPU cost of checking distances every frame. It only fires callbacks when a stimulus enters, updates, or leaves the perception radius."
            },
            {
              text: "What must the player character have for AI to perceive it?",
              options: ["A NavMesh component", "An AI Perception Stimuli Source component", "An AI Controller", "A State Tree"],
              correctIndex: 1,
              explanation: "The player needs an 'AI Perception Stimuli Source' component configured to generate stimuli (like being visible) that AI Perception can detect."
            },
            {
              text: "What defines how far the AI can see?",
              options: ["The NavMesh size", "The Sight Configuration's radius value", "The character's scale", "The level's fog settings"],
              correctIndex: 1,
              explanation: "The Sight sense configuration has a 'Sight Radius' parameter that defines the maximum detection distance."
            },
            {
              text: "What event fires when the AI spots or loses sight of a target?",
              options: ["On Actor Overlap", "On Target Perception Updated", "On Component Hit", "On See Player"],
              correctIndex: 1,
              explanation: "'On Target Perception Updated' is the delegate that fires whenever the perception state of a target changes (spotted, lost, etc.)."
            }
          ]
        }
      ]
    },

    // ── Chapter 5 ────────────────────────────────────────
    {
      id: "ch-5",
      number: 5,
      title: "Configuring State Tree Parameters and Evaluators",
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
          title: "State Tree Evaluators",
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
              text: "What is the role of an Evaluator in a State Tree?",
              options: ["It defines state transitions", "It runs tasks on the AI character", "It continuously updates parameters based on external data", "It handles animation blending"],
              correctIndex: 2,
              explanation: "Evaluators run every tick to read external data (like perception results) and write it into State Tree parameters that states and transitions can use."
            },
            {
              text: "What type should the 'TargetActor' parameter be?",
              options: ["Boolean", "Vector", "Actor Object Reference", "String"],
              correctIndex: 2,
              explanation: "The TargetActor parameter needs to hold a reference to an Actor in the world, so it should be an Actor Object Reference."
            },
            {
              text: "When do Evaluators execute?",
              options: ["Only when a state changes", "Every tick (continuously)", "Only during transitions", "Only once at startup"],
              correctIndex: 1,
              explanation: "Evaluators tick continuously, running their logic every frame to keep parameters up to date with the game world."
            },
            {
              text: "Why shouldn't you set State Tree parameters directly from the AI Controller?",
              options: ["It's not technically possible", "It bypasses the State Tree's update cycle, risking data inconsistency", "It's slower", "It causes compile errors"],
              correctIndex: 1,
              explanation: "Setting parameters outside the State Tree's update loop can cause race conditions where states read stale data. Evaluators ensure synchronized updates."
            },
            {
              text: "What bridges AI Perception and the State Tree?",
              options: ["A custom event", "The AI Perception Evaluator", "The NavMesh", "The Character Blueprint"],
              correctIndex: 1,
              explanation: "The AI Perception Evaluator reads perception events and writes the results into State Tree parameters, creating a clean bridge between the two systems."
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
              text: "What does the 'Find Random Reachable Point' task return?",
              options: ["A player reference", "A random location on the NavMesh", "A random rotation", "The nearest enemy"],
              correctIndex: 1,
              explanation: "This task queries the NavMesh and returns a random location that the AI can actually pathfind to."
            },
            {
              text: "What task makes the AI walk to a destination?",
              options: ["Set Actor Location", "Move To", "Add Movement Input", "Launch Character"],
              correctIndex: 1,
              explanation: "The 'Move To' task uses the NavMesh to pathfind and move the AI character to a specified location."
            },
            {
              text: "How does the AI continuously roam without stopping?",
              options: ["A timer Blueprint", "The state re-enters itself when the Move To task succeeds", "An infinite loop node", "The player triggers it"],
              correctIndex: 1,
              explanation: "When the Move To task completes successfully, the state's completion triggers it to re-enter, picking a new random point and moving again."
            },
            {
              text: "Why must the random point be 'reachable'?",
              options: ["Unreachable points crash the game", "The AI could get stuck trying to pathfind to an impossible location", "It's just a naming convention", "All points on the NavMesh are reachable"],
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
              text: "What's the difference between Move To with a location vs. an Actor?",
              options: ["No difference", "Actor targets update dynamically as the target moves; locations are static", "Locations are faster", "Actor targets only work in C++"],
              correctIndex: 1,
              explanation: "When targeting an Actor, Move To continuously updates its destination as the actor moves. With a static Vector location, it walks to that one point and stops."
            },
            {
              text: "What parameter does the Chase state use to find the player?",
              options: ["PlayerIndex", "TargetActor (set by the Evaluator)", "A hardcoded player reference", "The nearest actor"],
              correctIndex: 1,
              explanation: "The Chase state reads the TargetActor parameter, which the Evaluator continuously updates based on AI Perception data."
            },
            {
              text: "What does 'Acceptable Radius' control?",
              options: ["The AI's vision range", "How close the AI gets before considering the Move To complete", "The collision radius", "The NavMesh generation radius"],
              correctIndex: 1,
              explanation: "Acceptable Radius defines how close the AI needs to get to the target before the Move To task reports success. Without it, the AI would try to stand exactly on the target."
            },
            {
              text: "Can the Roam and Chase states exist simultaneously?",
              options: ["Yes, they run in parallel", "No  -  the AI is in exactly one state at a time", "Only in C++", "Only with Behavior Trees"],
              correctIndex: 1,
              explanation: "In a State Tree, the AI is always in exactly one state. Transitions swap between states  -  you're either Roaming or Chasing, never both."
            },
            {
              text: "Why does the AI re-pathfind when chasing?",
              options: ["It's a bug", "Because Move To with an Actor target continuously recalculates the path", "The player sends position updates", "The NavMesh changes at runtime"],
              correctIndex: 1,
              explanation: "Move To with an Actor reference automatically recalculates the path at intervals as the target's position changes."
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
          title: "Debugging State Trees",
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
              options: ["A timer expires", "The player presses a button", "TargetActor becomes valid (AI sees the player)", "The AI reaches a waypoint"],
              correctIndex: 2,
              explanation: "When the Evaluator sets TargetActor to a valid actor (because AI Perception detected the player), the transition condition from Roam to Chase is satisfied."
            },
            {
              text: "What condition triggers Chase → Roam?",
              options: ["The player dies", "TargetActor becomes invalid (AI loses sight)", "A cooldown timer", "The AI reaches the player"],
              correctIndex: 1,
              explanation: "When the player leaves the AI's perception radius, the Evaluator clears TargetActor, making it invalid and triggering the transition back to Roam."
            },
            {
              text: "How do you debug which state the AI is currently in?",
              options: ["Check the console", "Open the State Tree asset during PIE  -  active states highlight green", "Add breakpoints to the Character Blueprint", "Use the NavMesh visualizer"],
              correctIndex: 1,
              explanation: "The State Tree visual debugger highlights the active state in green during Play-In-Editor, letting you watch transitions in real-time."
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
