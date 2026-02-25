# Practical Debugging Tips for Horde

*Practical debugging tips for Horde, and general program outline.*

## 

- [{'type': 'paragraph', 'content': 'High level understanding of <a href="http://asp.net/">ASP.net</a> services'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Understand the concepts of <a href="https://dotnet.microsoft.com/en-us/apps/aspnet/mvc">MVC</a>'}]]}]
- [{'type': 'paragraph', 'content': 'Have a basic Horde Server & Agent setup'}]
- [{'type': 'paragraph', 'content': 'Aware of the existing Horde <a href="https://github.com/EpicGames/UnrealEngine/tree/5.6/Engine/Source/Programs/Horde/Docs">GitHub documentation</a>, and corresponding <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/horde-in-unreal-engine">Unreal Engine documentation</a>.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': '<i>(Optional)</i>\xa0Review the\xa0<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Docs/Glossary.md">Glossary.md</a>\xa0of Horde documentation.\xa0\xa0'}]]}]
- [{'type': 'paragraph', 'content': '(<i>Optional</i>)\xa0<a href="https://docs.google.com/document/d/1s_AzRRD2mdyktKUj2HWBn99rMg_3tcPvdjx3MPbFidU/edit?tab=t.0">Remote Worker API</a>\xa0- this is a fundamental core concept in how Horde works in relation to agents\xa0\xa0'}]
- [{'type': 'paragraph', 'content': "<i>(Optional)</i>\xa0Understand the concepts of JavaScript (TypeScript) & React if you're attempting to debug issues in the Dashboard."}]


## 

- [{'type': 'paragraph', 'content': '<b>If the issue is inconsistent…</b>'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Rule out environmental factors by removing infrastructure related implements'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Load balancers'}], [{'type': 'paragraph', 'content': 'Packet monitoring software'}], [{'type': 'paragraph', 'content': 'Virus scanner'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Particularly relevant for Storage Service throughput issues'}], [{'type': 'paragraph', 'content': 'Particularly relevant for File In Use throughput issues'}]]}], [{'type': 'paragraph', 'content': 'Containerized deployments'}], [{'type': 'paragraph', 'content': 'Perforce proxy OR edge servers'}]]}], [{'type': 'paragraph', 'content': 'Plot the errors in a spreadsheet to see if there’s a pattern that forms'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Agents involved in issue (and their OS configuration)'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Use <b>{HORDE_URL}/agents</b> view to introspect on agents'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Could there be a problem Agent that needs to be examined more thoroughly?'}]]}]]}], [{'type': 'paragraph', 'content': 'Times of issue'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Is there some scheduled task occurring during this time? An IT driven activity?'}]]}]]}], [{'type': 'paragraph', 'content': 'Evaluate <a href="https://learn.microsoft.com/en-us/shows/inside/event-viewer">Windows Event Viewer</a> (or related) to see if environmental warnings or errors have arisen during the error'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': '(<i>Related</i>) Check on Agent or Server memory & CPU load to see if there are suspicious patterns during the time of the error'}], [{'type': 'paragraph', 'content': '(<i>Related</i>) Check on Network usage to see if there are suspicious patterns during the time of the error'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Particularly relevant for Storage Service throughput issues'}]]}], [{'type': 'paragraph', 'content': '(<i>Related</i>) Check Process Explorer (or related) to see if dangling processes from the build toolchain or Unreal are causing file lock or resource contention intermittently'}]]}]]}]
- [{'type': 'paragraph', 'content': '<b>If the issue is deterministic, isolate for the least number of participating components</b>'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'For service or configuration issues'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Try to exercise the scenario in <b>HordeServer.*.Tests</b>'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'There are sufficient examples of how to mock collections, interact with services & controllers, generate configurations, etc.'}]]}], [{'type': 'paragraph', 'content': 'If it operates best on state present in your current instance (i.e. MongoDB), <b>exercise API endpoints with <a href="https://swagger.io/">Swagger</a>\xa0</b>(<i>HORDE_URL/swagger/index.html</i>)<b>,\xa0 or\xa0</b>with <b><a href="https://www.postman.com/">Postman</a></b>'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'You can also attach a Visual Studio debugger'}]]}]]}], [{'type': 'paragraph', 'content': 'For issues pertaining to Agent step execution, see if the issue can be isolated to the leaf action'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Logs contain most details on the exact environment variable state during build graph invocation'}]]}]]}]


## 


### 

- [{'type': 'paragraph', 'content': 'Server & Agent logs. Adequate history and log context windows are important - issues are often the result of events that happened farther back in the log than just the error line'}]
- [{'type': 'paragraph', 'content': 'Horde Installer context - are you using a Docker image or Windows installer? What version is the installer?'}]
- [{'type': 'paragraph', 'content': 'What is the exact version of the Engine? Horde Server & Agent do have some couplings to EpicGames.* C# namespace, which is shared. In rare occurrences, a mismatch between the installer build of Horde Server & Agent <b>and</b>\xa0the EpicGames.* C# libraries can cause issues.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Follow-up: is this a vanilla 5.X release, or is it a variant with project divergence? If the latter, the above point is even more relevant to introspect on.'}]]}]
- [{'type': 'paragraph', 'content': 'What OS environment is this executing on? Linux/Windows?'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'If applicable, what cloud environment is this executing on?'}]]}]


### 


#### 

- [{'type': 'paragraph', 'content': '<b><b>C:\\ProgramData\\Epic\\Horde\\Server\\Logs\\</b></b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Date segregated logs available'}]]}]
- [{'type': 'paragraph', 'content': '<i><b><b>C:\\ProgramData\\Epic\\Horde\\Agent\\</b></b></i>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Session logs all available here'}]]}]
- [{'type': 'paragraph', 'content': '<i>C:\\Users\\[user]\\AppData\\Local\\Epic Games\\Unreal Toolbox</i>'}]


#### 

- [{'type': 'paragraph', 'content': 'Controlled through application settings:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<a href="https://github.com/serilog/serilog/wiki/configuration-basics">Serilog</a>'}]]}]


```

```


### 

- [{'type': 'paragraph', 'content': 'Remote Desktop to get complete context'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'View leases (and corresponding logs) to evaluate error patterns'}]]}]
- [{'type': 'paragraph', 'content': 'Telemetry to see the birds-eye-view CPU & RAM usage'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Audit to see the collapsed views'}]]}]

- [{'type': 'paragraph', 'content': '<b>CPU </b>/api/v1/debug/profiler/cpu/start followed by /api/v1/debug/profiler/cpu/stop & /api/v1/debug/profiler/cpu/download'}]
- [{'type': 'paragraph', 'content': '<b>Memory</b> /api/v1/debug/profiler/mem/snapshot'}]


## 


### 


#### 

- [{'type': 'paragraph', 'content': '<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Docs/Deployment/Server.md#general">Server</a>'}]
- [{'type': 'paragraph', 'content': '<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Docs/Deployment/Agent.md#general">Agent</a>'}]


```

```


#### 

- [{'type': 'paragraph', 'content': '<b></b><a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/HordeServer/ServerApp.cs#L4"><b>ServerApp.cs</b> </a>- IConfiguration configuration = builder.Build'}]
- [{'type': 'paragraph', 'content': '<b><a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/HordeAgent/AgentApp.cs#L4">AgentApp.cs</a></b> - configuration = CreateConfig(...)'}]


### 

- [{'type': 'paragraph', 'content': 'OidcDebugMode (<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/HordeServer/ServerSettings.cs#L4">ServerSettings.cs</a>)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Debug mod which logs reasons for why JWT tokens fail to authenticate'}]]}]
- [{'type': 'paragraph', 'content': 'EnableDebugEndpoints (<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/HordeServer/ServerSettings.cs#L4">ServerSettings.cs</a>)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Enables the DebugController endpoints'}]]}]
- [{'type': 'paragraph', 'content': 'MongoReadOnlyMode (<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/HordeServer/ServerSettings.cs#L4">ServerSettings.cs</a>)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Access database in readonly mode; no indices created & useful for introspecting a prod database. Utilize with ReadOnly users to be safe.'}]]}]
- [{'type': 'paragraph', 'content': 'UseLocalStorageClient (<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/HordeAgent/AgentSettings.cs#L4">AgentSettings.cs</a>)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Switches agent storage to local instead of storage service. This is useful when diagnosing storage service issues.'}]]}]
- [{'type': 'paragraph', 'content': 'EnableGcVerification (<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Plugins/Storage/HordeServer.Storage/StorageConfig.cs#L4">StorageConfig.cs</a>)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Allows you to run GC for Storage Service, without deleting anything.'}]]}]


### 


## 


### 

- [{'type': 'paragraph', 'content': 'Underpowered Horde Server'}]
- [{'type': 'paragraph', 'content': 'Excessive load'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'I.e. Many steps completing at the same time (and publishing artifacts to the storage server at the same time)'}]]}]
- [{'type': 'paragraph', 'content': 'Insufficient network bandwidth'}]
- [{'type': 'paragraph', 'content': 'Suboptimal topography (Server & Agents are geographically separated).'}]
- [{'type': 'paragraph', 'content': 'Virus scanners hampering reads/writes or network traffic'}]
- [{'type': 'paragraph', 'content': 'MongoDB <b>or </b>Redis instance underpowered'}]
- [{'type': 'paragraph', 'content': 'Excessive temporaries being copied across agents'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'If you intend to <b>always</b>\xa0use a particular byproduct of a given build, in a subsequent step, it may be beneficial to consolidate these within the same node in order to reduce temporaries being transferred. Refer to <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/buildgraph-for-unreal-engine#writingbuildgraphscripts">BuildGraph</a>\xa0documentation in how to best utilize BuildGraph to achieve this.'}]]}]


### 

- [{'type': 'paragraph', 'content': 'By including fingerprint information directly in the <a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Docs/Internals/StructuredLogging.md">structured log event</a> at the point that it is generated.'}]
- [{'type': 'paragraph', 'content': 'By post-processing <a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Docs/Internals/StructuredLogging.md">structured log events</a> in the Horde server once a build step completes.'}]

- [{'type': 'paragraph', 'content': '<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Drivers/JobDriver/Parser/LogParser.cs#L4">LogParser.cs</a> (JobDriver) and constituent Parser/Matcher folder in the Visual Studio solution (all linked files to various matchers - for convenience) contain the event matchers'}]
- [{'type': 'paragraph', 'content': 'When we match an event from the input stream, we create an event'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>WriteEventsAsync </b>via <b><a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Shared/EpicGames.Horde/Logs/ServerLogger.cs#L4">ServerLogger.cs</a></b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'gRPC call into CreateLogEvents -&gt; AddEventsAsync -&gt; AddEvents Async()'}]]}], [{'type': 'paragraph', 'content': 'This ties into the producer consumer Channel pattern'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>RunDataWriterAsync </b>as the reader'}], [{'type': 'paragraph', 'content': '<b>WriteFormattedEvent </b>as the writer'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>LogEventParser.WriteLine</b>(), <b>LogEventParser.ProcessData</b>() (where Event Matchers are evaluated), and <b>LogEventParser.WriteEvents</b>() interfaces'}]]}]]}]]}]

- [{'type': 'paragraph', 'content': 'IgnorePatterns via the ReadIgnorePatternsAsync interface (LogEventParser)'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'The Build\\Horde\\IgnorePatterns.txt being the operative file containing the ignores'}]]}]


### 


#### 


```

```


```

```

- [{'type': 'paragraph', 'content': 'We have explicitly deleted a reference'}]
- [{'type': 'paragraph', 'content': 'It has expired (done via TickRefsAsync)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'ArtifactTypeConfig - KeepCount & KeepDays'}]]}]

- [{'type': 'paragraph', 'content': 'Are any other blobs referring to it in their Import list (Storage.Blob{“imp”:[...]})'}]
- [{'type': 'paragraph', 'content': 'Is there a Storage.Ref entry for the blob'}]

- [{'type': 'paragraph', 'content': 'Update it’s `xa` metadata to attempt to force an expiration; this is far more graceful than explicitly deleting the ref'}]


#### 


#### 

- [{'type': 'paragraph', 'content': '\xa0\xa0<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Docs/Config/Schema/Streams.md?plain=1#L213">conformDiskFreeSpace\xa0</a>helps guarantee free space\xa0\xa0'}]


### 


#### 


#### 


#### 


```

```


#### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<a href="https://www.perforce.com/blog/vcs/helix-core-server-resource-pressure-awareness-proactive-monitoring">Pressure Awareness</a>\xa0'}]
- [{'type': 'paragraph', 'content': '<a href="https://ftp.perforce.com/perforce/r16.2/doc/manuals/cmdref/p4_monitor.html">P4 monitor</a>'}]
- [{'type': 'paragraph', 'content': '<a href="https://help.perforce.com/helix-core/server-apps/p4sag/current/Content/P4SAG/chapter.performance.html">Perforce Performance Tuning</a>'}]


### 

- [{'type': 'paragraph', 'content': 'Use the <b>/api/v1/account/entitlements</b> API to get the entitlements for the current user;'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'This helps you verify whether they should be able to interact with a particular Acl Action'}]]}]
- [{'type': 'paragraph', 'content': 'Determine which token is involved in your auth/permissions issue'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Common operations interact with different tokens'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': '<i>SoftwareToken </i>(upload new versions of agent software)'}], [{'type': 'paragraph', 'content': '<i>SoftwareDownloadToken </i>(download new versions of agent software)'}], [{'type': 'paragraph', 'content': '<i>ConfigToken </i>(Configure streams and projects)'}], [{'type': 'paragraph', 'content': '<i>RegistrationToken </i>(to register an agent)'}]]}], [{'type': 'paragraph', 'content': 'Agents have a bearer token for initial installation'}], [{'type': 'paragraph', 'content': 'Agents get a token minted for work'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': '<b>UE_HORDE_TOKEN </b>is the environment variable used to store the JIT minted token.'}], [{'type': 'paragraph', 'content': 'This is used by the agent in order to have appropriate entitlements for operation.'}], [{'type': 'paragraph', 'content': 'If you’re seeing issues with Agent access, you can inspect the injection point at <b><a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/HordeAgent/Leases/Handlers/JobHandler.cs#L4">JobHandler.cs</a></b> <b>ExecuteAsync </b>(agent side) and the minting at <a href="https://github.com/EpicGames/UnrealEngine/blob/5.5/Engine/Source/Programs/Horde/Plugins/Build/HordeServer.Build/Jobs/JobTaskSource.cs#L902">CreateExecuteJobTaskAsync </a>(server side).'}], [{'type': 'paragraph', 'content': 'The default set of entitlements for agents is observed here'}]]}], [{'type': 'paragraph', 'content': 'Users get an authentication token stored at <b>oidcTokenStore.dat</b>.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'TryDoRefreshTokenAsync in OIDCTokenManager is the primary entry point for diagnosing token refreshes, and inspecting the contents therein.'}]]}], [{'type': 'paragraph', 'content': 'Obtain a token for a given user via <b><i>/api/v1/admin/token</i></b>.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Run through <a href="https://jwt.io/">https://jwt.io/ </a>to verify the claims as expected.'}], [{'type': 'paragraph', 'content': '<b>jwtExpiryTimeHours </b>is a helpful configuration tool for when you want the issued tokens to have extended lifetime (typically for debugging purposes).'}], [{'type': 'paragraph', 'content': 'You can place this within the <b>BuildConfiguration.xml</b>...'}, {'type': 'paragraph', 'content': '<i>&lt;Horde&gt;&lt;Token&gt;{YOUR_TOKEN}&lt;/Token&gt;&lt;/Horde&gt; </i>'}, {'type': 'paragraph', 'content': '... segment to use for UBA invocations (given your user has entitlements for <b>AddComputeTasks</b>).'}]]}]]}]
- [{'type': 'paragraph', 'content': 'Users (and their associated claims & entitlements) can be inspected upon Authorization calls in most *Controller.cs endpoints:'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'E.g. <a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Horde/Plugins/Compute/HordeServer.Compute/Compute/ComputeController.cs#L108">AssignComputeResourceInClusterAsync</a>'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'AclConfig.Authorize is of particular interest'}]]}]]}]


### 


## 


### 


#### 


#### 


#### 


#### 


### 


#### 


#### 


### 


#### 


##### 

- [{'type': 'paragraph', 'content': 'HordeServer as startup project'}]
- [{'type': 'paragraph', 'content': 'HordeAgent as startup project'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': '<a href="https://devblogs.microsoft.com/devops/introducing-the-child-process-debugging-power-tool/">Microsoft Visual Studio Child Process Debugging</a> is useful for JobDriver debugging - this only works when you’re debugging a Horde Agent process that was initiated from Visual Studio. You cannot attach to child processes from an attached Horde Agent parent process.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'You will need to modify the ManagedProcess.cs code to <b>not use a Managed Process Group</b>.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'if (<a href="https://github.com/EpicGames/UnrealEngine/blob/5.6/Engine/Source/Programs/Shared/EpicGames.Core/ManagedProcess.cs#L592">ManagedProcessGroup.SupportsJobObjects</a>) should be replaced with if(false).'}]]}]]}]]}]
- [{'type': 'paragraph', 'content': 'Consult the aforementioned tables on Files & Projects for insight into where to place breakpoints.'}]
- [{'type': 'paragraph', 'content': 'Start the Server Application first'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Start the Agent Application; it will attempt to connect to your localhost @ port 5000.'}], [{'type': 'paragraph', 'content': 'Emulate the interaction you’d like to debug (either from Swagger rest APIs, or Server/Agent behaviour). If your environment is set up correctly, you should start hitting breakpoints.'}], [{'type': 'paragraph', 'content': 'Optionally, set environment variables according to\xa0<a href="https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-7.0#naming-of-environment-variables">ASP.net standards</a>. Alternatively can set in server.json (seen below).'}]]}]


```

```


##### 


##### 

- [{'type': 'paragraph', 'content': 'Creating a new plugin within\xa0<a href="https://github.com/EpicGames/UnrealEngine/tree/5.6/Engine/Source/Programs/Horde/Plugins">Engine\\Source\\Programs\\Horde\\Plugins</a>.\xa0'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/snippets/2W1l/unreal-engine-creating-a-new-horde-server-plugin">Snippets here</a>.'}], [{'type': 'paragraph', 'content': '<a href="https://epicgames.box.com/s/5hnlcsfehtjll2nvp896oss2e2nnenvp">Full download here</a>.'}]]}]
- [{'type': 'paragraph', 'content': 'Adding it to the Horde solution'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Right click on the Solution\\Plugins folder and Add -&gt; New Solution Folder'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Name it the name of the plugin'}]]}], [{'type': 'paragraph', 'content': 'Adding the plugin *.csproj (and test *.csproj) to the newly created folder'}], [{'type': 'paragraph', 'content': 'Adding a reference from the Horde Server csproj to the above csproj'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Add -&gt; Project Reference'}], [{'type': 'paragraph', 'content': 'Select the csproj file of the new plugin'}], [{'type': 'paragraph', 'content': 'Right click HordeServer in Solution view'}]]}]]}]


#### 

- [{'type': 'paragraph', 'content': 'Navigate to <b>ROOT_TO_SYNC\\Engine\\Source\\Programs\\Horde\\HordeDashboard</b>'}]
- [{'type': 'paragraph', 'content': '"<i>npm install --legacy-peer-deps</i>" & "<i>npm run build</i>"'}]
- [{'type': 'paragraph', 'content': "Copy contents of the generated 'Dist' folder to\xa0<b>ROOT_TO_SYNC\\Engine\\Source\\Programs\\Horde\\HordeServer\\DashboardApp</b>"}]


### 


#### 

- [{'type': 'paragraph', 'content': 'This is done on demand via MongoService.'}]
- [{'type': 'paragraph', 'content': 'You can specify a new specific database via'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'MongoDatabaseName (either by env var or settings)'}], [{'type': 'paragraph', 'content': 'When we try to access a collection, we will update & create indices if need be'}]]}]
- [{'type': 'paragraph', 'content': 'Reviewing code with *Collection.cs will be helpful in understanding various details of collections that are in MongoDB, and a generally useful entry point into MongoDB.'}]


#### 

- [{'type': 'paragraph', 'content': '<a href="https://stackexchange.github.io/StackExchange.Redis/Configuration.html">Config & connection string</a>'}]
- [{'type': 'paragraph', 'content': 'Reviewing instances of “RedisKey” code use throughout the codebase (and particularly within *Collection.cs) will highlight entry points into the redis DB.'}]


```

```


```

```