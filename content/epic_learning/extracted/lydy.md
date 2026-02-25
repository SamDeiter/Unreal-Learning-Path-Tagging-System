# Using Chaos Callbacks for a Custom Gravity System, working with round worlds

*In this tutorial, we’ll see how to hook into Chaos’s callbacks mechanism to craft a system able to globally apply custom forces like Round-Planet Gravity without any prerequisites on the gameplay objects.*

## 

- [{'type': 'paragraph', 'content': "I want to be able to apply different gravity/attraction effects depending on the actors' location"}]
- [{'type': 'paragraph', 'content': 'I will focus on Characters, Vehicles, and Rigid Bodies first. (Knowing that some modules like Water are not ready for it yet)'}]
- [{'type': 'paragraph', 'content': 'I want a less-intrusive as possible system that won’t require a specific setup for Pawns or Projectiles'}]
- [{'type': 'paragraph', 'content': 'I want it to work with Player-controlled AND AI-controlled pawns.'}]
- [{'type': 'paragraph', 'content': 'I don’t want to be “polluted” by the default gravity, so we will disable it.'}]


## 


### 

- [{'type': 'paragraph', 'content': 'Create a new BP Project from the Game Blank Template'}]
- [{'type': 'paragraph', 'content': 'Create a new Level, and add a textured sphere to simulate the planet'}]
- [{'type': 'paragraph', 'content': 'We want to be working with vehicles, so make sure to enable the Chaos Vehicle plugin in your project.'}]
- [{'type': 'paragraph', 'content': 'I migrated the Third-Person Character and the Sports Car Vehicle from their respective templates. (I deliberately did not want to start from an existing template, to have only regular pawns, and a project with minimal content.)'}]
- [{'type': 'paragraph', 'content': 'I added the typical Custom Game Modes and Player Controller.'}]
- [{'type': 'paragraph', 'content': 'The basic inputs are all processed in the RoundPlanetPlayercontroller, possessing and unpossessing some pre-existing pawns from the level.'}]


### 

- [{'type': 'paragraph', 'content': 'We’ll start with a Default Pawn to have a free view by default.'}]
- [{'type': 'paragraph', 'content': 'The pawns that can be possessed will be given a “Possessable” Tag, and only these ones will be collected by the Player Controller on BeginPlay. The Tab key will possess one, and subsequent presses will iterate over them, using Shift to iterate in reverse order. Enter will revert to the Default Pawn.'}]
- [{'type': 'paragraph', 'content': 'I added two AI controllers (because input movement is different for vehicles and characters), and made the pawns automatically possessed by these AIs.'}]
- [{'type': 'paragraph', 'content': 'To differentiate between regular Pawns and bots, I changed the Color scheme. Blue is Player-driven, Red is bot-driven'}]


### 

- [{'type': 'paragraph', 'content': 'Add a new BP_Projectile actor, which is just a Static Mesh actor with “Simulate Physics” enabled on the Static Mesh component. (Make sure the mesh you’re using has a proper collision mesh.)'}]
- [{'type': 'paragraph', 'content': 'On the Player Controller, add a Middle Mouse Button event, and bind it to a ShootProjectile Function'}]
- [{'type': 'paragraph', 'content': 'In the ShootProjectile Function, spawn a new BP_Projectile and set its initial velocity towards the camera direction. Optionally, replace the mesh with a Cube if the shift key is pressed.'}]


## 

- [{'type': 'paragraph', 'content': 'Chaos-simulated objects'}]
- [{'type': 'paragraph', 'content': 'Characters with CMC'}]


### 

- [{'type': 'paragraph', 'content': 'Forces applied to objects are gathered to compute accelerations using Newton’s Law.'}]
- [{'type': 'paragraph', 'content': 'These accelerations are integrated to compute the expected position of the rigid body.'}]
- [{'type': 'paragraph', 'content': 'Collisions that happen between objects because of this motion are detected, resolved, and produce new reaction forces.'}]
- [{'type': 'paragraph', 'content': 'We iterate until the new physical state is stable.'}]


### 


## 

- [{'type': 'paragraph', 'content': 'Define Attractors by using Scene components'}]
- [{'type': 'paragraph', 'content': 'Have a Tickable World Subsystem for managing this custom gravity system. This object will be the only one with an async physics callback'}]
- [{'type': 'paragraph', 'content': 'Have an implementation of the Physics callback that will add additional acceleration to Chaos Rigid Bodies'}]
- [{'type': 'paragraph', 'content': 'Keep track of the CMC components in the world to set their gravity vector.'}]


### 


#### 

- [{'type': 'paragraph', 'content': '<b><i>UCustomGravityWorldSubSystem</i></b>'}]
- [{'type': 'paragraph', 'content': 'We want to have it Tickable to have an entry point for per-frame updates'}]
- [{'type': 'paragraph', 'content': 'Add the typical overrides, like <b><i>Initialize</i></b>, <b><i>DeInitialize</i></b>, and <b><i>OnWorldBeginPlay</i></b>.'}]
- [{'type': 'paragraph', 'content': 'Don’t forget to override the pure virtual <b><i>GetStatId</i></b> function, or you’ll be crashing at startup… It’s needed for the Stats associated with Subsystems.'}]


#### 

- [{'type': 'paragraph', 'content': '<b><i>UGravityAttractorComponent</i></b>'}]
- [{'type': 'paragraph', 'content': 'For easier manipulation, we can have these components register themselves with the UCustomGravityWorldSubSystem.'}]
- [{'type': 'paragraph', 'content': 'Add properties for Gravity'}]


```

```


```

```


```

```


```

```


#### 

- [{'type': 'paragraph', 'content': 'Input Data (Sent from the Game Thread to the Physics Thread) - <b><i>Chaos::FSimCallbackInput</i></b>'}]
- [{'type': 'paragraph', 'content': 'Output Data (Sent from the Physics Thread back to the Game Thread) - <b><i>Chaos::FSimCallbackOutput</i></b>'}]
- [{'type': 'paragraph', 'content': 'A list of Entry points in the physics thread where they need to be called. <b><i>Chaos::ESimCallbackOptions</i></b>'}]

- [{'type': 'paragraph', 'content': "A custom Input (conveying the Attractors' Mass and Locations)"}]
- [{'type': 'paragraph', 'content': 'No Output'}]
- [{'type': 'paragraph', 'content': 'Hook on the <b>PreIntegrate </b>entry point'}]

- [{'type': 'paragraph', 'content': 'A new C++ struct containing the relevant data for each Gravity Attractor: <b><i>FGravityAttractorData</i></b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Contains Location and Mass Properties'}]]}]
- [{'type': 'paragraph', 'content': 'A new C++ struct inheriting from the FSimCallbackInput Class: <b><i>FCustomGravityAsyncInput</i></b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Contains an Array of <b><i>FGravityAttractorData</i></b>.'}], [{'type': 'paragraph', 'content': 'It’s important to implement the Reset() method and clear the data at each cycle.'}]]}]
- [{'type': 'paragraph', 'content': 'A new C++ class inheriting from <b><i>TSimCallbackObject</i></b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'With <b><i>FCustomGravityAsyncInput </i></b>as Input Data template'}], [{'type': 'paragraph', 'content': 'With <b><i>FSimCallbackNoOutput </i></b>as Output Data template'}], [{'type': 'paragraph', 'content': 'With <b><i>PreIntegrate </i></b>(and Presimulate) <b><i>ESimCallbackOptions</i></b>.'}], [{'type': 'paragraph', 'content': 'Because of the two ESimCallbackOptions above, we need to override the two virtual functions'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b><i>OnPreSimulate_Internal() </i></b>- Can be empty here.'}], [{'type': 'paragraph', 'content': '<b><i>OnPreIntegrate_Internal()</i></b> - Will contain the code to read the input data and have a new acceleration added to the particles.'}]]}]]}]


```

```


```

```


```

```


```

```


```

```


```

```


### 

- [{'type': 'paragraph', 'content': 'On Initialize, register two <b><i>ActorSpawnedHandle </i></b>and <b><i>ActorDestroyedHandle </i></b>callbacks that will be called upon dynamic Actor creation/suppression'}]
- [{'type': 'paragraph', 'content': 'On Deinitialize, reset these callbacks'}]
- [{'type': 'paragraph', 'content': 'Add <b><i>AddActorToTrackedCharacters</i></b>/<b><i>RemoveActorFromTrackedCharacters </i></b>functions to look if an actor has a CMC, and store it in an array if yes.'}]
- [{'type': 'paragraph', 'content': 'We’ll iterate through the existing actors on BeginPlay because the Callbacks are called only for dynamically spawned objects.'}]
- [{'type': 'paragraph', 'content': 'Add a new <b><i>UpdateCMCGravities()</i></b> function. Called on <b><i>Tick()</i></b>, it will iterate over the tracked CMC, compute the composed gravity from all attractors, and set the gravity direction, and Force!'}]


```

```


```

```


### 


```

```


## 


### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Add the two following nodes on BeginPlay to make the Springarms relative to the pawn.'}]
- [{'type': 'paragraph', 'content': 'Check the three Inherit Pitch/Yaw/Roll Checkboxes on the Back SpringArm'}]


## 


### 


##