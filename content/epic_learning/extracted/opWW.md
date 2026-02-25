# Profiling Game Memory and Performance

*Tutorial explaining how to use the engine's built in Memory Profiling tools along with Unreal Insights*

## 

- [{'type': 'paragraph', 'content': '<b>Debug and DebugGame</b>: These configurations should not be used for profiling because they are compiled without optimizations.'}]
- [{'type': 'paragraph', 'content': '<b>Development Editor</b>: Basic CPU profiling can be done when launching your game inside the editor, but Unreal Insights traces will include the time required to update the editor UI. Some assets use far more memory in the editor than in a packaged game so memory profiling can be misleading.'}]
- [{'type': 'paragraph', 'content': '<b>Development Standalone</b>: This mode is used when launching an editor build with -game on the command line or using the Standalone Game play option from the editor. This will launch a separate executable that is halfway between an editor build and a packaged build, so it is more accurate than a Play in Editor session.'}]
- [{'type': 'paragraph', 'content': '<b>Development Game</b>: This is a cooked and packaged build of the game that has some optimizations enabled and has access to all debugging tools. It is great for memory profiling and works well for performance profiling with some caveats described below.'}]
- [{'type': 'paragraph', 'content': '<b>Test Game</b>: Test configuration is generally the best configuration for performance profiling because it has all optimizations enabled but still has most of the debugging tools required to profile performance.'}]
- [{'type': 'paragraph', 'content': '<b>Shipping Game</b>: This is the final build you would ship to users so it has none of the profiling tools described in this tutorial. It will generally be slightly faster and use slightly less memory than Test, but you should not depend on that when optimizing your game.'}]

- [{'type': 'paragraph', 'content': '<code class="inline-code">ALLOW_LOW_LEVEL_MEM_TRACKER_IN_TEST</code>: If you enable this configuration option, Test builds will be able to output detailed memory information. It is always enabled in Development.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">RHI_WANT_RESOURCE_INFO</code>: This define (also settable with bTrackRHIResourceInfoForTest) adds debug information to rendering assets.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">ENABLE_STATNAMEDEVENTS</code>: If you enable this in Test (which may be enabled by default), it will track the information needed to handle the -statnamedevents command line parameter mentioned below. This is unnecessary on Development as it is handled by the STATS define.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">ENABLE_STATNAMEDEVENTS_UOBJECT</code>: This enables even more information for stat named events, but will slow down performance while profiling.'}]


```

```


## 

- [{'type': 'paragraph', 'content': '<code class="inline-code">-trace=&lt;ListOfChannels&gt;</code>: The primary option for enabling Unreal Insights fully described in the <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-reference-in-unreal-engine-5">documentation</a>, this enables trace channels and will try to send traces to an active instance of Unreal Insights that is set to Auto-connect.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-tracehost&lt;=IP&gt;</code>: This specifically tells the trace system to connect to a specific Unreal Trace Server used by Unreal Insights. You can specify an IP which is required on certain platforms.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-tracefile&lt;=filename&gt;</code>: This outputs trace information to a file on disk next to where log files are saved, this can be used when a trace server is not available.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-statnamedevents</code>: This enables additional CPU trace events that list specific assets and objects and requires Development or ENABLE_STATNAMEDEVENTS to work properly. This option adds significant CPU overhead (as much as 20%) so you may not want it enabled for all tests.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-ExecCmds="stat unitgraph, stat fps"</code>: This tells it to run a series of console commands after engine initialization. In this example it turns on some fps monitors but you can put other commands inside the quotes.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-NoVerifyGC</code>: This disables some Garbage Collection debugging that slows things down in Development (it is always disabled in Test).'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-NoVsync</code>: Disables vsync for a specific test run, which is important for getting reliable results for certain types of performance profiling.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-DPCvars="cvarname=value"</code>: DPCVars can be used to override Device Profile CVars which can be used to change specific options for a single test.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-LogCmds="LogGarbage Verbose"</code>: LogCmds is used to increase or decrease log verbosity which can affect performance. In this example it shows detailed Garbage Collection Stats.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-HandleEnsurePercent=0</code>: Disables all ensures, avoiding performance issues if there are errors. You should only use this if you cannot fix ensures normally.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-llm</code>: Specifically enables the Low Level Memory tracker, which is also automatically enabled when using -trace=memory and related options.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-ClearPSODriverCache</code>: This clears the video driver shader cache, which will make your profiles more consistent from run to run.'}]


## 

- [{'type': 'paragraph', 'content': 'Install, Compile, and Load CitySample in the editor.'}]
- [{'type': 'paragraph', 'content': 'Using the Platform menu, Select the Windows platform and Development configuration and then click Package Project to start the package. It will ask you for a directory which can be anywhere you want, but remember the Packaged Root for later. The first cook will be fairly slow.'}]
- [{'type': 'paragraph', 'content': 'Go to the folder you selected during packaging and run CitySample.exe to ensure that everything is working properly. The exe in the Packaged Root is actually a wrapper for the real game binary in CitySample/Binaries/Win64.'}]
- [{'type': 'paragraph', 'content': 'Set up a method for launching CitySample.exe with appropriate command line parameters, there are many ways to do this:'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Use a Terminal program to launch your executable with extra parameters, and copy-paste the ones you want. I recommend keeping a list in a text document.'}], [{'type': 'paragraph', 'content': 'Set up a .bat file or windows Shortcut where you can easily change parameters.'}], [{'type': 'paragraph', 'content': 'Set up an automated test framework like <a href="https://dev.epicgames.com/community/learning/talks-and-demos/0zx9/unreal-engine-a-tech-artist-s-guide-to-automated-performance-testing-unreal-fest-bali-2025">Automated Performance Testing</a> to execute the tests for you with specific parameters.'}], [{'type': 'paragraph', 'content': 'If you are a programmer, you can launch a compiled executable using data from the packaged build which is great for fast iteration. To do this in Visual Studio, select Development as the build configuration and then change the command line parameters using the <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/using-the-unrealvs-extension-for-unreal-engine-cplusplus-projects">UnrealVS</a> plugin or another method. If you add a parameter like <b>-basedir=&lt;Packaged Root&gt;\\CitySample\\Binaries\\Win64\xa0</b>it will correctly use the packaged data.'}]]}]
- [{'type': 'paragraph', 'content': 'Compile and launch Unreal Insights which will spawn the Unreal Insights Frontend and wait for a trace if the "Auto-Connect" option is enabled at the bottom (it is enabled by default).'}]
- [{'type': 'paragraph', 'content': 'Add the appropriate command line options to your launch setup for <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/memory-insights-in-unreal-engine">Memory Insights</a>\xa0traces. For this example I used <b>-trace=default,memory,metadata,assetmetadata </b>which enables memory and CPU traces and connects to the Unreal Insights Frontend launched above. If you are only capturing CPU performance change the options to something like <b>-trace=default,task</b> as described in the <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-reference-in-unreal-engine-5">documentation</a>.'}]
- [{'type': 'paragraph', 'content': 'Launch CitySample.exe with those options, then wait for the camera to finish moving.'}]
- [{'type': 'paragraph', 'content': 'In the console enter "memreport -full" and hit enter to output a memory report to the Saved folder that we will look at later (not required when only using Memory Insights).'}]
- [{'type': 'paragraph', 'content': 'In the console enter the "exit" command to close the game.'}]
- [{'type': 'paragraph', 'content': 'Go to Unreal Insights and look for the trace it created. If you followed these steps it should be the last trace listed in the Trace Store tab. If you used -tracefile you will need to find the file in CitySample/Saved/Profiling and drag it on to the UI or use the Open Trace button.'}]
- [{'type': 'paragraph', 'content': 'Select the correct trace file to load it in Insights. If you select the Session tab at the top it should show the full command line it launched with, Timing Insights has the CPU profile and Memory Insights has the memory profile'}]
- [{'type': 'paragraph', 'content': 'Go to your Packaged Root directory, and go into the CitySample/Saved/Profiling directory. You should see a MemReports directory (and a utrace file if you used -tracefile). Open the appropriate .memreport file in a text editor (like Notepad++ or Visual Studio) that handles large files well'}]


## 

- [{'type': 'paragraph', 'content': 'Open the Timing Insights Tab and look at the bar graph at the top which shows all frames in your profile. It defaults to showing both rendering and game frame information, but if you right click and unselect Rendering Frames you will get a bar chart of game thread time:'}, {'type': 'image', 'image_id': 79407, 'caption': '', 'alt_text': '', 'image': {'id': 79407, 'file_name': 'image.png', 'file_size': 437425, 'content_type': 'image/png', 'created_at': '2025-10-09T21:19:09.657+00:00', 'height': 389, 'width': 1600, 'storage_key': 'ced5d1ea-2b16-47f7-8e30-b337cc60902f', 'context': 'learning'}, 'storage_key': 'ced5d1ea-2b16-47f7-8e30-b337cc60902f', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'To find a specific frame, you can click on the bar chart and then zoom in with the mouse wheel (or hit F on the keyboard) to focus on one frame. Look for a frame of normal gameplay (near the end of the pink section in the above screenshot) before you ran the memory profile, and zoom in. This screenshot also shows some of the Timing Regions track which includes some events like level loads and garbage collection:'}, {'type': 'image', 'image_id': 79408, 'caption': '', 'alt_text': '', 'image': {'id': 79408, 'file_name': 'image.png', 'file_size': 504962, 'content_type': 'image/png', 'created_at': '2025-10-09T21:19:53.790+00:00', 'height': 925, 'width': 1339, 'storage_key': 'a9a57986-6cd6-45f8-b302-796648961536', 'context': 'learning'}, 'storage_key': 'a9a57986-6cd6-45f8-b302-796648961536', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'You can now click on individual events which will change the stats on the right. The above example was taken without -statnamedevents so it is missing specific object names, but you can see that it is a fairly slow frame, with a lot of time taken by two Mass Processor Tasks.'}]
- [{'type': 'paragraph', 'content': 'To dig into this issue more, you can take additional insights captures with different options or use a stack-based profiler like Superluminal to investigate the specific C++ functions being called during those time periods. Here is that same situation with\xa0<b>-trace=default,task -statnamedevents</b>:'}, {'type': 'image', 'image_id': 79409, 'caption': '', 'alt_text': '', 'image': {'id': 79409, 'file_name': 'image.png', 'file_size': 500685, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:05.537+00:00', 'height': 912, 'width': 1326, 'storage_key': '441be1f8-f6f7-48ef-a562-83693f3f0a7e', 'context': 'learning'}, 'storage_key': '441be1f8-f6f7-48ef-a562-83693f3f0a7e', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'With those trace parameters the overall frame time is lower (with vsync adding extra idle time), and there are a lot of small events happening inside the MassStateTreeActivationProcessor. After zooming in to look inside that event, you can see what is happening in more detail:'}, {'type': 'image', 'image_id': 79410, 'caption': '', 'alt_text': '', 'image': {'id': 79410, 'file_name': 'image.png', 'file_size': 422279, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:13.294+00:00', 'height': 702, 'width': 1600, 'storage_key': '47e4e4fe-7782-4e6b-88c5-49139f0cb925', 'context': 'learning'}, 'storage_key': '47e4e4fe-7782-4e6b-88c5-49139f0cb925', 'context': 'learning', 'width': None}]


## 

- [{'type': 'paragraph', 'content': 'Open the Memory Insights tab and zoom out so you can see the full session, it should look something like this:'}, {'type': 'image', 'image_id': 79411, 'caption': '', 'alt_text': '', 'image': {'id': 79411, 'file_name': 'image.png', 'file_size': 439469, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:21.160+00:00', 'height': 904, 'width': 1600, 'storage_key': '21b896e5-4638-4482-a8d2-7618911cdf55', 'context': 'learning'}, 'storage_key': '21b896e5-4638-4482-a8d2-7618911cdf55', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Zoom in on the high point of the Live Allocation Count graph which should be when you ran the memreport command. If you look above the timeline you can see when it executed specific console commands which can help you find the appropriate frame to investigate.'}]
- [{'type': 'paragraph', 'content': 'We want to see all the active allocations at a specific point in time. To do this, we can use the Active Allocs option in the Investigation tab which requires setting a single marker (named A, where other options use more markers). Right click the timeline near the memreport command and select Move Time Marker A to set a marker at that point, it should look like this:'}, {'type': 'image', 'image_id': 79412, 'caption': '', 'alt_text': '', 'image': {'id': 79412, 'file_name': 'image.png', 'file_size': 318207, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:31.853+00:00', 'height': 901, 'width': 1600, 'storage_key': '8d176a84-bf90-4a12-baba-6d3b380fffa5', 'context': 'learning'}, 'storage_key': '8d176a84-bf90-4a12-baba-6d3b380fffa5', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'On the right side tab select the Active Allocs rule like in the screenshot, make sure A is enabled and click Run Query. This will look at all active memory allocations and create a new Allocs Table window to display the report.'}]
- [{'type': 'paragraph', 'content': 'The default view does not have any groupings enabled (you can add them by clicking the &gt; next to All), but you can click the Default drop down on the right to select a new view like Tags. Then you can click the Size header to sort the tags by size:'}, {'type': 'image', 'image_id': 79413, 'caption': '', 'alt_text': '', 'image': {'id': 79413, 'file_name': 'image.png', 'file_size': 600726, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:38.456+00:00', 'height': 967, 'width': 1600, 'storage_key': 'aa96799d-cec7-42a9-9d51-a350d1e6f830', 'context': 'learning'}, 'storage_key': 'aa96799d-cec7-42a9-9d51-a350d1e6f830', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'From this view it is immediately obvious that most of the memory is in Textures and other things related to rendering (RHIMisc and RHITransientResources) but there is also substantial memory in more detailed categories like Meshes and UObject that we can investigate. In this tags view (and any other view), you can mouse over one of the entries inside a folder and it will show you the call stack as a tooltip which helps find where the memory was actually allocated.'}]
- [{'type': 'paragraph', 'content': 'To break it down based on type of asset, change the View to Class Name and sort by size again, it will list the classes and individual assets that use memory. After adjusting some of the column widths and expanding some folders it should look like this:'}, {'type': 'image', 'image_id': 79414, 'caption': '', 'alt_text': '', 'image': {'id': 79414, 'file_name': 'image.png', 'file_size': 1166660, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:44.689+00:00', 'height': 964, 'width': 1600, 'storage_key': 'e23e992f-634f-41b2-ba65-cb990dcaa657', 'context': 'learning'}, 'storage_key': 'e23e992f-634f-41b2-ba65-cb990dcaa657', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'To see another view of memory usage, switch to the Asset (Package) view which organizes the allocations based on the where the assets are located in your content tree:'}, {'type': 'image', 'image_id': 79415, 'caption': '', 'alt_text': '', 'image': {'id': 79415, 'file_name': 'image.png', 'file_size': 541100, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:52.056+00:00', 'height': 967, 'width': 1600, 'storage_key': 'e5384d1d-e4ea-46fc-9671-d3ee593e2e66', 'context': 'learning'}, 'storage_key': 'e5384d1d-e4ea-46fc-9671-d3ee593e2e66', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'Another important feature of memory insights is the Memory Tags tab (called LLM Tags in earlier versions) on the main page, and it is very useful for doing comparisons over time. To use this, close the Allocs Table and click Memory Tags, then change the View to Diff B-A. This will add a new marker to the timeline view that you can move to set before and after points. After doing that you can sort by the Diff column and should see something like this:'}, {'type': 'image', 'image_id': 79416, 'caption': '', 'alt_text': '', 'image': {'id': 79416, 'file_name': 'image.png', 'file_size': 914198, 'content_type': 'image/png', 'created_at': '2025-10-09T21:20:59.031+00:00', 'height': 905, 'width': 1600, 'storage_key': 'e213b9e1-ed50-40ec-bd2e-1b62b1c9bc4e', 'context': 'learning'}, 'storage_key': 'e213b9e1-ed50-40ec-bd2e-1b62b1c9bc4e', 'context': 'learning', 'width': None}]
- [{'type': 'paragraph', 'content': 'That example shows how much memory was allocated during the spike right before I ran memreport. Looking at the stats, it appears that some MetaSounds and SkeletalMeshes were loaded during this time. You can click the &gt; next to All to add an additional grouping like Callstacks to help track down where the memory is going.'}]


## 


```

```


#### 


```

```

- [{'type': 'paragraph', 'content': '<b>Class</b> is the specific UClass used by that UObject. Blueprints will show up as their own class in this list.'}]
- [{'type': 'paragraph', 'content': '<b>Count</b> is the number of instances of that class which are currently in memory.'}]
- [{'type': 'paragraph', 'content': '<b>NumKB</b> is the minimum amount of memory that would be required to store UObject structure itself (in kilobytes) which includes all UProperty fields.'}]
- [{'type': 'paragraph', 'content': '<b>MaxKB</b> is the actual amount of memory that is used by the UObject structure including array slack that is not currently used. This is usually a better estimate of memory usage than NumKB.'}]
- [{'type': 'paragraph', 'content': '<b>ResExcKB</b> is short for Resource Exclusive Kilobytes and is the amount of other memory that is owned by those objects. This is handled in class-specific GetResourceSizeEx functions. Because it can be difficult to know which resources are used exclusively by a single object, this may include some memory that is shared by multiple objects.'}]
- [{'type': 'paragraph', 'content': 'The last 3 columns are Dedicated System, Dedicated Video, and Unknown resource sizes, which add up to give the total resource size. This is only important for detailed memory profiling.'}]


```

```


#### 


#### 


#### 


#### 


## 


### 


### 


### 


### 


### 


## 

- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/paths/Rkk/unreal-engine-unreal-performance-optimization-learning-path">Unreal Performance Optimization Learning Path</a>\xa0has many useful links'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=HQLYkwoDoT4">Mastering Performance Analysis with Unreal Insights</a>\xa0is a video tutorial from UnrealFest Bali 2025'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/community/learning/tutorials/qEzo/unreal-engine-profiling-with-purpose-performance-lessons-from-a-real-unreal-project">Profiling with Purpose: Performance Lessons From a Real Unreal Project</a> from UnrealFest Stockholm 2025 has a nice video overview of the process'}]
- [{'type': 'paragraph', 'content': '<a href="https://www.youtube.com/watch?v=ji0Hfiswcjo">The Road to 60 fps in The Witcher 4 Unreal Engine 5 Tech Demo</a> covers many of the newer profiling and optimization features'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/how-to-use-unreal-insights-to-profile-android-games-for-unreal-engine">Unreal Insights on Android Devices</a> describes how to profile an external device, you can use similar methods on other platforms'}]