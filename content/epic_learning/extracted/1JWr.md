# Apple Vision Pro Quick Start Guide

*Apple Vision Pro Quick Start Guide*

### 

- [{'type': 'paragraph', 'content': 'A Mac with Apple silicon (m1, m2, m3) is required'}]
- [{'type': 'paragraph', 'content': 'Xcode 15.3 with visionOS 1.1 support installed'}]


### 

- [{'type': 'paragraph', 'content': 'Get it setup and connected to your wifi, or use the developer strap'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Developer strap is recommended as wifi can be unreliable'}]]}]
- [{'type': 'paragraph', 'content': 'Update to visionOS 1.1'}]
- [{'type': 'paragraph', 'content': 'Go to Settings -&gt; Privacy and security -&gt; Developer mode, and set it to On'}]


### 

- [{'type': 'paragraph', 'content': 'Create a New Project'}]
- [{'type': 'paragraph', 'content': 'Select the visionOS tab, choose App, then click next (see image)'}]
- [{'type': 'paragraph', 'content': 'Under Immersive Space Renderer, choose “Metal”, then click Next'}]
- [{'type': 'paragraph', 'content': 'Choose a folder to save the project in, and click Create'}]
- [{'type': 'paragraph', 'content': 'Choose your AVP device in the top dropdown (see image). If you don’t see it here, go to Window -&gt; Devices and Simulators, and verify that your AVP is connected.'}]
- [{'type': 'paragraph', 'content': 'Run the app (Command+R, or Play button in the top left)'}]
- [{'type': 'paragraph', 'content': 'Start Xcode'}]


### 

- [{'type': 'paragraph', 'content': 'Install Unreal Engine 5.5 through GitHub (The binary version downloaded from the Epic Games Launcher is not supported at this time, but will be in the future)'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Build the editor'}]]}]
- [{'type': 'paragraph', 'content': 'Launch editor and create a new VR Template project'}]
- [{'type': 'paragraph', 'content': 'The following console variables are now set in both <code class="inline-code">Engine/Platforms/VisionOS/Config/VisionOSEngine.ini</code> and\xa0<code class="inline-code">MyProject/Config/VisionOS/VisionOSEngine.ini</code>\xa0so you should not need to set them, unless you are intentionally changing them.'}, {'type': 'paragraph', 'content': 'vr.InstancedStereo=False'}, {'type': 'paragraph', 'content': 'vr.MobileMultiView=False'}, {'type': 'paragraph', 'content': 'xr.OpenXRAcquireMode=1'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': []}]
- [{'type': 'paragraph', 'content': 'Go to Project Settings -&gt; Platforms -&gt; iOS -&gt; Build -&gt; Additional Plist Data, and add the following string:\xa0<code class="inline-code">&lt;key&gt;NSHandsTrackingUsageDescription&lt;/key&gt;&lt;string&gt;Track your hands to interact with the application.&lt;/string&gt;</code>'}]
- [{'type': 'paragraph', 'content': 'Add a C++ class to make it a code project'}]
- [{'type': 'paragraph', 'content': 'Enable OpenXR visionOS plugin, then click restart'}]
- [{'type': 'paragraph', 'content': 'In the Unreal Editor toolbar, click Platforms -&gt; visionOS, and choose where to save the package (it doesn’t matter where)'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'This will start packaging the project'}], [{'type': 'paragraph', 'content': 'If it fails during cooking, run this after (replacing the bold part): ./RunUAT.sh BuildCookRun -project="<b>/Users/josh.adams/Documents/Unreal Projects/VisionOSTest/VisionOSTest.uproject</b>" -platform=VisionOS -build -skipcook -stage -pak'}]]}]
- [{'type': 'paragraph', 'content': 'Open the visionOS Xcode workspace in your Unreal project directory'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'For "MyProject", it would be "MyProject (VisionOS).xcworkspace"'}]]}]
- [{'type': 'paragraph', 'content': 'Set the Xcode Product-&gt; Scheme to your project'}]
- [{'type': 'paragraph', 'content': 'Ensure your Vision Pro is the Product-&gt; Destination and that it is unlocked and awake (same as Xcode prerequisites Step 6)'}]
- [{'type': 'paragraph', 'content': 'Run the app (Command+R, or Play button in the top left)'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'If you switch over to the Deferred desktop renderer, run with -norhithread (Xcode product scheme has a place to put command line arguments) to avoid an error complaining that we call cp_frame_ functions from two threads (see image)'}]]}]


### 

- [{'type': 'paragraph', 'content': 'In <code class="inline-code">\\Engine\\Platforms\\VisionOS\\Source\\Runtime\\Launch\\Source\\UESwift.swift</code> comment out the line below that sets the ImmersionStyle to .full and uncomment the line that sets the ImmersionStyle to .mixed.'}]

- [{'type': 'paragraph', 'content': 'In VisionOSEngine.ini uncomment the three cvar settings:'}]

- [{'type': 'paragraph', 'content': 'Change content to allow some see-through areas. For example, remove the skybox and walls, and set the floor to be hidden in game (to retain collision).'}]