# Best Practices for Networked Movement Abilities (CMC)

*Deep dive into how to interact with and extend the Character Movement Component when making new movement mechanics in a networked game.*

- [{'type': 'paragraph', 'content': 'Relevant UE replication and networking terminology'}]
- [{'type': 'paragraph', 'content': "A high level overview of CMC's networking model"}]
- [{'type': 'paragraph', 'content': 'Challenges combining CMC with other replicated systems, such as the Gameplay Ability System (GAS)'}]
- [{'type': 'paragraph', 'content': 'Options for dealing with those challenges and their trade-offs'}]
- [{'type': 'paragraph', 'content': 'Best and good practices to choose from and bad practices to avoid'}]
- [{'type': 'paragraph', 'content': 'Ways to reproduce, understand and debug movement observed in-game'}]


### 

- [{'type': 'paragraph', 'content': '<b>Player feel:</b> To make movement feel responsive players should see a result of their input presses as soon as possible. That means predicting outcome, like a character immediately walking when you tilt the joystick instead of waiting for a server response.'}]
- [{'type': 'paragraph', 'content': '<b>Staying synchronized:</b> Characters should appear to have the same location and appearance on the server and all clients. This is never exactly the case due to latency and prediction. If a large positional difference is measured that difference should be corrected, usually on clients.'}]
- [{'type': 'paragraph', 'content': '<b>Feeling fair</b>: Not only should things feel responsive for an acting player, other players should have a fair chance to react.'}]
- [{'type': 'paragraph', 'content': '<b>Avoid exploitability</b>: Cheaters will attempt to exploit any RPCs and parameters a game client can send to the server. When you introduce RPCs and parameters to give the game client more ways to control their character, you must mitigate how those can be exploited.'}]


### 


#### 

- [{'type': 'paragraph', 'content': '<b>Packets</b>: Any request or data sent between server and client is sent as packets of binary data over the network.'}]
- [{'type': 'paragraph', 'content': '<b>Remote Procedural Calls (RPC)</b>: A function that is called on one node on the network, but executed on another node. For example: the client calling a function that executes on the server.'}]
- [{'type': 'paragraph', 'content': '<b>Latency</b>:\xa0\n\nPackets sent over the network arrive with a delay:\xa0<i>latency</i>\xa0or\xa0<i>lag</i>. RPCs take time to travel from server to client and vice versa. The same applies to server to client property replication.\xa0\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Round-trip delay (RTD)</b>: Either the measured, or expected time, of sending a packet plus receiving a response for that packet. Also called round-trip time (RTT).'}]
- [{'type': 'paragraph', 'content': "<b>Network jitter</b>: The amount of delay differs from packet to packet. When you call multiple RPCs they may arrive with different delays. RPCs may arrive in a different order than they were sent. Two RPCs sent in the same frame don't necessarily arrive at the same time, nor in the same order."}]
- [{'type': 'paragraph', 'content': '<b>Packet loss</b>: Packets sent over the network may fail to arrive at their destination.'}]
- [{'type': 'paragraph', 'content': '<b>Ack (acknowledgement):</b> A network packet sent as a response to let the sender know a certain packet has been received. Like any packet acks may fail to arrive due to packet loss.'}]


#### 

- [{'type': 'paragraph', 'content': '<b>Reliable RPCs:</b> You can mark a function as a reliable RPC via <code class="inline-code">UFUNCTION(Reliable)</code>. Unreal will guarantee that the RPC will execute on the destination, as long as the replicated\xa0<code class="inline-code">UObject</code> is still alive there. Reliable RPCs will be resent if necessary, for example if a previous attempt failed due to packet loss. Reliable RPCs called on the same actor, or components belonging to the same actor, are guaranteed to execute in the same order on the destination. That does mean an RPC is not immediately executed when received if a previous one hasn\'t arrived yet.'}]
- [{'type': 'paragraph', 'content': '<b>Unreliable RPCs</b>: The alternative is <code class="inline-code">UFUNCTION(Unreliable)</code>. When an unreliable RPC does not arrive due to packet loss, it is simply never executed on the destination. Unreliable RPCs are executed immediately when received, with no regard for order of sending.'}]

- [{'type': 'paragraph', 'content': "<b>Execution delay:</b> when an earlier sent RPC on the same actor or its component hasn't arrived yet. This problem becomes worse with more packet loss."}]
- [{'type': 'paragraph', 'content': "<b>Round-trip delay(s):</b> when an RPC doesn't arrive due to packet loss and must be resent. Resends are triggered either by the timeout passing for receiving an ack for an RPC or receiving an ack for a later RPC."}]
- [{'type': 'paragraph', 'content': "Risk of <b>reliable buffer overflow</b>: as long as the sender hasn't received an ack for an RPC they must hold onto them to potentially resend. That buffer can grow and hit a configurable limit, at which point the client gets disconnected because their network connection is deemed too unstable to satisfy the reliable RPC guarantees. Your game code is more likely to run into this if you carelessly send many reliable RPCs."}]


### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'The server is ahead of clients for all server-controlled replicated actors including NPCs, projectiles and most other non-player-controlled actors.\xa0'}]
- [{'type': 'paragraph', 'content': "A game client is ahead of the server for a locally controlled pawn (autonomous proxy). It's two steps ahead of other clients for that pawn (which have a simulated proxy for that pawn), because the player's inputs must first reach the server and the server's outcome must then reach those other clients."}]


#### 

- [{'type': 'paragraph', 'content': 'They may be configured with a different frame rate.'}]
- [{'type': 'paragraph', 'content': 'Even if configured with the same frame rate, hitches can result in different amounts of time passing in-between frames. Tick functions will receive different delta-time values.'}]


#### 


#### 

- [{'type': 'paragraph', 'content': 'When an ability requires standing in a special area like tall grass or in water. Movement prediction may put the player in that area on the client, but a movement update may not have arrived yet on the server that puts the player there when the ability RPC arrives. The ability is unfairly rejected.'}]
- [{'type': 'paragraph', 'content': 'When a local predicted ability activation increases movement speed it affects the next movement updates. If movement updates affected by the increased speed arrive on the server before the ability activation does, the server may reject the movement because it finds no reason for the player to be so far ahead. The move is unfairly rejected.'}]


#### 

- [{'type': 'paragraph', 'content': 'Your movement code is called during resimulation'}]
- [{'type': 'paragraph', 'content': 'The values accessed represent the past world and character state'}]


### 


#### 

- [{'type': 'paragraph', 'content': '<b>Fixed Latency </b>(same min and max): Useful for reproducing movement corrections in a controlled manner. When something happens only on the server, or the server gets a different result, you know it will take exactly that amount of latency for the client to receive the correction. If the client sends a bad move, it will take a round-trip to receive the correction. This is good for testing custom resimulation logic.'}]
- [{'type': 'paragraph', 'content': '<b>Variable Latency</b>: Enables network jitter and reproduces the RPC arrival timing issue. Moves and other RPCs sent in the same frame can now arrive at different times. You must test with this, because it will happen in a live environment.'}]
- [{'type': 'paragraph', 'content': '<b>Packet Loss</b>: Unreliable RPCs may never arrive, including movement RPCs with inputs. Reliable RPCs may arrive with additional round-trip(s) of delay. This will also happen in live.'}]


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Override <code class="inline-code">UCharacterMovementComponent::OnClientCorrectionReceived(...)</code>\xa0to record debug shapes at the characters pre- and post correction location similar to <code class="inline-code">p.NetShowCorrections 1</code>'}]
- [{'type': 'paragraph', 'content': 'Override <code class="inline-code">FSavedMove_Character::PrepMoveFor(...)</code>\xa0to process where the character is at the start of a replayed move.'}]
- [{'type': 'paragraph', 'content': 'Override <code class="inline-code">FSavedMove_Character::PostUpdate(...)</code>\xa0to process where the character is after replaying a move.'}]


```

```


#### 


```

```


### 


#### 


#### 


##### 


```

```

- [{'type': 'paragraph', 'content': 'Calling\xa0<code class="inline-code">CMC-&gt;FlushServerMoves()</code>\xa0at any time, such as when calling an RPC that depends on latest location. This causes any move that was combined over the last few frames to be sent at the end of this frame. This is already called by GAS when activating local predicted abilities. This does <b>not</b> prevent the RPC arrival timing issue, it only prevents additional delay from move combining.'}]
- [{'type': 'paragraph', 'content': 'Setting\xa0<code class="inline-code">SavedMove-&gt;bForceNoCombine</code>\xa0to true for the current move.'}]
- [{'type': 'paragraph', 'content': 'Overriding\xa0<code class="inline-code">FSavedMove_Character::CanCombineWith(...)</code>\xa0to return false for two adjacent moves.'}]


##### 

- [{'type': 'paragraph', 'content': '<b>OldMove</b>\xa0(optional): An unacked important move.'}]
- [{'type': 'paragraph', 'content': "<b>PendingMove (optional)</b>:<b>\xa0</b>A\xa0move that has been combining the past few frames if it wasn't combinable with NewMove."}]
- [{'type': 'paragraph', 'content': '<b>NewMove</b>: The latest move, performed this tick. It may also be a combined move.'}]


#### 

- [{'type': 'paragraph', 'content': "When receiving a new move will execute it immediately, skipping over moves\xa0that haven't arrived yet due to jitter."}]
- [{'type': 'paragraph', 'content': 'It then applies a larger delta-time to bridge the gap.'}]
- [{'type': 'paragraph', 'content': "Moves that arrive late, i.e. have a timestamp that's before an already processed move, are ignored."}]

- [{'type': 'paragraph', 'content': '<b>Location: </b>The server allows a maximum squared positional error of 3.0 by default. This translates to 1.73 Unreal units, or 1.73 cm.'}]
- [{'type': 'paragraph', 'content': '<b>Movement Mode</b>: If the character ends up in a different movement mode (walking, falling, swimming, etc) between the server and client, a correction is triggered too.'}]


```

```


#### 

- [{'type': 'paragraph', 'content': "<b>bAckGoodMove</b>: Whether this is a good move. If not, it's a correction."}]
- [{'type': 'paragraph', 'content': '<b>TimeStamp</b>: The client-provided timestamp of the move that this is a response to.'}]
- [{'type': 'paragraph', 'content': '<b>NewLoc, NewVel</b>: The location and velocity that the server decided on as outcome for that move.'}]
- [{'type': 'paragraph', 'content': '<b>NewRot</b> (optional): The rotation that the server decided on. By default, CMC does not correct rotation but it can, by overriding <b>CMC::ShouldCorrectRotation()</b>\xa0to return true server-side in contexts where rotation should be corrected.'}]
- [{'type': 'paragraph', 'content': '<b>MovementMode</b>: The movement mode that the character ended in on the server.'}]
- [{'type': 'paragraph', 'content': '<b>NewBase /\xa0</b>\n\n<b>NewBaseBoneName</b>: The movement base which is the primitive component whose coordinate space is used as base for location and velocity. This is for contexts when the actor is moving attached to another moving primitive.'}]
- [{'type': 'paragraph', 'content': '<b>bRootMotionSourceCorrection: </b>Whether the correction also contains server-provided root motion sources (RMS). See the next section on RMS. The correction data is custom serialized server-side into an FArchive and is custom deserialized from that FArchive into a client-side active root motion source. See\xa0<code class="inline-code">FCharacterMoveResponseDataContainer::GetRootMotionSourceGroup()</code>.'}]

- [{'type': 'paragraph', 'content': '<code class="inline-code">CMC::ClientAdjustPosition_Implementation()</code> is called client-side to adopt the server\'s outcome.'}]
- [{'type': 'paragraph', 'content': 'On the next tick, <code class="inline-code">CMC::ClientUpdatePositionAfterServerUpdate()</code> is called to resimulate multiple saved moves instantly.'}]


#### 


### 


#### 


##### 


##### 

- [{'type': 'paragraph', 'content': "The client predicting some effect that the server doesn't do or does differently: a misprediction. For example: if on the game client the player starts running you can predictively let the character move faster. If the server doesn't think the character has stamina to run, a correction happens and the character gets snapped back on the client."}]
- [{'type': 'paragraph', 'content': 'The client <i>not</i> predicting something, such as actions of other players and NPC behaviors that are executed server-side.'}]


##### 


##### 


##### 


#### 


##### 

- [{'type': 'paragraph', 'content': "On first prediction on the client, using the client's world tick time."}]
- [{'type': 'paragraph', 'content': 'When the server executes the move sent by the client, using the client timestamp derived delta-time.'}]
- [{'type': 'paragraph', 'content': 'When the client receives a correction from the server, each replayed move is re-performed with the original world tick time.'}]
- [{'type': 'paragraph', 'content': 'On other clients (simulated proxies) in special cases like playing root motion sources or animation which are ticked on those clients for smooth visualization.'}]

- [{'type': 'paragraph', 'content': 'Overriding <code class="inline-code">CMC::StartNewPhysics()</code> which gets called regardless of movement mode'}]
- [{'type': 'paragraph', 'content': 'Overriding <code class="inline-code">CMC::PhysWalking(), PhysFalling(), PhysSwimming(), PhysCustom()</code>, etc which gets called if the character is in that movement mode.'}]
- [{'type': 'paragraph', 'content': 'Applying (custom) <b>Root Motion Sources</b> via code or GAS, which are extra sources of velocity that get evaluated in <code class="inline-code">PerformMovement()</code> with the correct time-since-start and delta-time in all contexts.'}]


##### 


##### 

- [{'type': 'paragraph', 'content': "Game clients are behind of the server for non-local controlled actors like NPCs: when the player interacts with an NPC they are interacting with a position that's already outdated on the server by current latency."}]
- [{'type': 'paragraph', 'content': "By the time the server receives the player's ability input, twice the current latency has passed and a server-controlled actor has moved forward that much. The current location of the NPC on the server is two (latency) steps ahead of the location that the player interacted with."}]


##### 

- [{'type': 'paragraph', 'content': 'Referenced actors may have moved or been destroyed'}]
- [{'type': 'paragraph', 'content': 'Attributes and tags may have changed: movement speed, stunned, frozen, etc.'}]

- [{'type': 'paragraph', 'content': 'Override <code class="inline-code">FSavedMove_LabCharacter::PrepMoveFor(...)</code> to restore values from the saved move onto the character and CMC. This gets called client-side during resimulation right before that move gets resimulated.'}]
- [{'type': 'paragraph', 'content': 'Or: let your code inside <code class="inline-code">CMC::PerformMovement()</code> check for <code class="inline-code">CharacterOwner-&gt;bClientUpdating</code>. If true, you\'re replaying a past move. Then call <code class="inline-code">CMC-&gt;GetCurrentReplayedSavedMove()</code> to retrieve the saved move currently being replayed and access any of its properties that you recorded.'}]


##### 

- [{'type': 'paragraph', 'content': 'Using the current GAS GameplayAttribute value during resimulation, instead of the past one.'}]
- [{'type': 'paragraph', 'content': "Using a target actor's current location instead of the past one."}]


#### 


##### 

- [{'type': 'paragraph', 'content': '<b>Custom NetworkMoveData: </b>Introduce\xa0a custom <code class="inline-code">FCharacterNetworkMoveData</code> class that your CMC subclass sends to the server as moves via the <code class="inline-code">ServerMovePacked()</code> RPC that\'s part of CMC\'s networking protocol. You can add more variables to the move data and customize when and how they are net serialized.'}]
- [{'type': 'paragraph', 'content': '<b>Other RPCs:</b> Use other RPCs to send those move inputs. They can be provided by the engine like GAS ability RPCs (activation, targeting, wait net sync), or they can be server RPCs you introduce yourself either in code or blueprints.'}]

- [{'type': 'paragraph', 'content': "<b>Modularity</b>: Although you can introduce variables to a NetworkMoveData subclass, this isn't modular. External systems can't add variables, unless you implement your own solution to inject data into your NetworkMoveData subclass."}]
- [{'type': 'paragraph', 'content': '<b>Efficient net serialization</b>: If you introduce networked parameters into NetworkMoveData it would be wasteful to serialize them every time. For example, if you have 10 variables for ziplining it\'s wasteful to send them over the network when the player isn\'t ziplining. It\'s up to you to write an efficient <code class="inline-code">FMyCharacterNetworkMoveData::Serialize()</code> function that compresses the data by conditionally serializing properties.'}]
- [{'type': 'paragraph', 'content': '<b>Limit exploitability</b>: Cheating players will try to manipulate what values are serialized as part of network move data. Any new variable introduces a vulnerability that cheaters can try to abuse at all times. The server-side code has to check gameplay context and validity of values.'}]

- [{'type': 'paragraph', 'content': "<b>Modularity by default</b>: RPCs can be introduced in any GameplayAbility blueprint. You don't have to work in one class. This is in contrast to adding features to NetworkMoveData which has either a maintenance burden and/or engineering setup burden to add modularity."}]
- [{'type': 'paragraph', 'content': '<b>Efficient net serialization by default:</b> RPCs and arguments are only sent when the RPC is called.'}]
- [{'type': 'paragraph', 'content': '<b>Smaller exploitability scope</b>: Cheaters can only call server RPCs on currently replicated <code class="inline-code">UObjects</code>\xa0. Since not all abilities exist at all times, they cannot try and call every RPC. They can try to try to call RPCs on any currently granted ability though.'}]


##### 

- [{'type': 'paragraph', 'content': 'When an RMS is active move combining is always skipped, so the client will send moves every tick.\xa0The reason for this is because the RMS class may define any type of movement behavior, so without looking deeper CMC assumes move combining is not applicable. This increases server CPU load.'}]
- [{'type': 'paragraph', 'content': 'The GAS way (which by default is the only way) of activating RMSes on both server and client involves an RPC, so the RPC arrival timing issue is unavoidable.'}]


##### 

- [{'type': 'paragraph', 'content': 'When a move contains any timing sensitive data, you should not delay sending it thus it should not be combined.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">ClientNetSendDeltaTime</code> should be at least the server\'s tick rate or longer. Otherwise, it\'s likely that the client sends multiple combined moves that execute within one server-side world tick which is unnecessary granularity. When granularity is relevant like during volatile movement, moves shouldn\'t be combined anyway.'}]


##### 


#### 

- [{'type': 'paragraph', 'content': ' <mark class="cdx-marker">RPC arrival timing issue</mark> when you don\'t handle all move inputs through\xa0<code class="inline-code">CMC::ServerMovePacked()</code>'}]
- [{'type': 'paragraph', 'content': 'CMC moves skipped server-side due to arriving out of order'}]
- [{'type': 'paragraph', 'content': 'CMC moves dropped\xa0(possibly with inputs) server-side due to packet loss'}]
- [{'type': 'paragraph', 'content': "Server-only factors that the game client couldn't predict"}]
- [{'type': 'paragraph', 'content': "Actions from other players that the game client couldn't predict"}]
- [{'type': 'paragraph', 'content': 'Server-side lack of world rollback when executing player moves (saves performance)'}]
- [{'type': 'paragraph', 'content': 'Client and server fundamental desync: evaluating moves against different world states'}]


##### 

- [{'type': 'paragraph', 'content': 'If an increased error tolerance is exceeded after all, this now results in one bigger correction. This can be more noticeable than what would have been multiple smaller corrections.'}]
- [{'type': 'paragraph', 'content': 'When lowering the error tolerance back down, for example at the end of an ability, this can immediately trigger a correction if positional error has accumulated throughout the ability.'}]

- [{'type': 'paragraph', 'content': 'When playing an animation with volatile root motion. Server and client can be at different times in the animation, which affects position, but they will end up at the same place.'}]
- [{'type': 'paragraph', 'content': 'A grappling hook ability, targeted dash ability: network jitter can cause the server and client to be at different locations in transit but the end point is the same.'}]
- [{'type': 'paragraph', 'content': 'Falling: the character might have a large Z-positional error while in the air, but when it hits the ground the Z-coordinate will be synchronized again.'}]


##### 


#### 


##### 


##### 


##### 


##### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">CMC::ForcePositionUpdate()</code> is called once server-side when the server has not received moves for a while. That timeout is ini-configurable via <code class="inline-code">AGameNetworkManager::MAXCLIENTUPDATEINTERVAL</code> and is 0.25 seconds by default.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">CMC::TickAutonomousProxy()</code> is always called server-side on world tick.'}]


#### 


##### 

- [{'type': 'paragraph', 'content': 'Cheaters can attempt to exploit this by abusing the error tolerance if they approximately know the value. With every move they send to the server they can lie about the outcome position in NetworkMoveData to teleport within that error tolerance distance. This lets them move a little faster or more erratic than fair play would allow.'}]
- [{'type': 'paragraph', 'content': 'Observing clients now have two latency steps or delay until they receive the authoritative position, so their representation of the other player is more out of sync. That can feel unfair when interacting with other players.'}]


##### 


### 

- [{'type': 'paragraph', 'content': '<b>Debugging\xa0</b>movement with network emulation, Visual Logger and PIE single process global vars.'}]
- [{'type': 'paragraph', 'content': '<b>CMC </b>networking where the client leads and the server reproduces and validates moves. Move combining and important moves affect when the client sends moves. Unintentional move combining is a common cause of desync problems.'}]
- [{'type': 'paragraph', 'content': 'Challenges in networking movement stem from RPC arrival timing, ticking with different delta-times, applying moves against different world states. Some problems are not avoidable without sacrificing responsive gameplay, like the server and client being ahead for different actors.'}]
- [{'type': 'paragraph', 'content': '<b>Best practices</b> start with keeping things inside <code class="inline-code">CMC::PerformMovement()</code>, so that they are prediction, server move and resimulation compatible. Changing a character\'s location and velocity directly, for example in tick functions, is a <mark class="cdx-marker">bad practice</mark>.'}]
- [{'type': 'paragraph', 'content': 'We covered ways to minimize divergence between server and client when performing moves. An important consideration is whether to\xa0send all inputs via a custom <code class="inline-code">FSavedMove_Character</code>, <code class="inline-code">FCharacterNetworkMoveData</code>\xa0and overridden <code class="inline-code">CMC::Phys</code> functions. That approach avoids the RPC arrival timing issue but is an engineering heavy solution. Root motion sources and custom RPCs in <i>Gameplay Abilities</i>\xa0are an alternative, which does have the timing drawback.'}]
- [{'type': 'paragraph', 'content': 'After minimizing divergence, you can consider adding lenience during volatile gameplay by introducing dynamic error tolerance for position or temporarily disabling or ignoring corrections. This adds a risk of a larger correction later if not used carefully.'}]
- [{'type': 'paragraph', 'content': 'You can consider giving the client <i>slightly\xa0</i>more positional authority during specific short-lived actions, but that makes the game also <i>slightly</i>\xa0more cheatable.'}]