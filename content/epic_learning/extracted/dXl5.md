# Advanced Debugging in Unreal Engine

*Are you tired of relying on the same old PrintString for bug hunting? Boring! It's time to level up your Unreal Engine debugging skills!
Join Unreal Engine Evangelist Ari Arnbjörnsson for a wild ride through advanced techniques and tools that will make bugs quake in their boots!*

### 


### 


## 


## 


```

```


## 


```

```


## 


### 


### 

- [{'type': 'paragraph', 'content': '<strong>log LogStreaming verbose</strong> – See when any asset gets loaded.'}]
- [{'type': 'paragraph', 'content': '<strong>log LogGarbage verbose</strong> – See detailed GC timings.'}]


## 


### 

- [{'type': 'paragraph', 'content': 'Tools -&gt; Debug -&gt; Widget Reflector, or'}]
- [{'type': 'paragraph', 'content': 'CTRL + SHIFT + W, or'}]
- [{'type': 'paragraph', 'content': 'Typing “WidgetReflector” into the console.'}]


### 


### 


```

```


### 


### 


```

```


```

```


### 


### 


## 

- [{'type': 'paragraph', 'content': 'Checked out (as in writable, when using P4) C++ files via adaptive unity builds'}]
- [{'type': 'paragraph', 'content': 'BuildConfiguration.xml: true.'}]
- [{'type': 'paragraph', 'content': 'Target.cs: bAdaptiveUnityDisablesOptimizations = true;.'}]

- [{'type': 'paragraph', 'content': 'BuildConfiguration.xml: ModuleName.'}]
- [{'type': 'paragraph', 'content': 'Build.cs: OptimizeCode = CodeOptimization.InShippingBuildsOnly or CodeOptimization.Never.'}]
- [{'type': 'paragraph', 'content': 'Target.cs: DisableOptimizeCodeForModules array.'}]

- [{'type': 'paragraph', 'content': 'UE_DISABLE_OPTIMIZATION/UE_ENABLE_OPTIMIZATION.'}]
- [{'type': 'paragraph', 'content': 'Add UE_CHECK_DISABLE_OPTIMIZATION=1 to your CI builds to prevent accidentally shipping with code unoptimized.'}]


### 

- [{'type': 'paragraph', 'content': 'Project Settings → Project → Packaging → Project → Include Debug Files.'}]
- [{'type': 'paragraph', 'content': "A shipping build without debug files can't ever have its crashes debugged."}]
- [{'type': 'paragraph', 'content': "But don't ship them with your game, store them yourself elsewhere."}]
- [{'type': 'paragraph', 'content': 'Visual Studio builds (F5) always make symbols.'}]


### 

- [{'type': 'paragraph', 'content': 'Can be just a shared folder on a NAS drive.'}]
- [{'type': 'paragraph', 'content': 'Can also be exposed to the internet.'}]

- [{'type': 'paragraph', 'content': 'Use symstore.exe to put symbol files into proper file structure.'}]
- [{'type': 'paragraph', 'content': 'Reference your symbol store in Visual Studio:'}]


### 

- [{'type': 'paragraph', 'content': 'Run p4index.cmd for Perforce repos. Needs Perl installed.'}]


### 


### 

- [{'type': 'paragraph', 'content': 'Customize crash reporter.'}]
- [{'type': 'paragraph', 'content': 'Aggregate crashes via 3rd party service.'}]

- [{'type': 'paragraph', 'content': 'Sets dictionary values that will get included in the xml file for crashes / assertions.'}]

- [{'type': 'paragraph', 'content': 'Can be turned off with <strong>bSendUnattendedBugReports=false</strong> (but why would you?)'}]


### 

- [{'type': 'paragraph', 'content': 'Or CTRL + click the smaller arrow, or Right click -&gt; Set Next Statement, or CTRL + SHIFT + F10.'}]
- [{'type': 'paragraph', 'content': 'Redo code if you didn’t catch what happened the first time.'}]
- [{'type': 'paragraph', 'content': 'Skipping exceptions.'}]


### 

- [{'type': 'paragraph', 'content': 'UnrealEditor-Core!GConfig'}]
- [{'type': 'paragraph', 'content': 'UnrealEditor-Engine!GPlayInEditorContextString'}]
- [{'type': 'paragraph', 'content': 'UnrealEditor-Core!GFrameCounter'}]


### 


### 


### 


### 


```

```


```

```


```

```


### 


### 

- [{'type': 'paragraph', 'content': 'Pair program or debug with a single click.'}]
- [{'type': 'paragraph', 'content': 'Look at different files and even stack frames while debugging.'}]
- [{'type': 'paragraph', 'content': 'Live collaborate with up to 30 people.'}]
- [{'type': 'paragraph', 'content': 'Insanely powerful, you’re missing out if you’ve never used it!'}]


### 


### 


### 


### 


### 


```

```


### 


### 

- [{'type': 'paragraph', 'content': 'r.Shaders.Optimize=0 (only when debugging, not when profiling)'}]
- [{'type': 'paragraph', 'content': 'r.Shaders.Symbols=1'}]
- [{'type': 'paragraph', 'content': 'r.Shaders.SkipCompression=1'}]
- [{'type': 'paragraph', 'content': 'r.ShaderDevelopmentMode=1'}]


## 


## 


### 


### 


### 


###