# Build-time Asset and Plugin Exclusion

*Write code to decide at build and cook-time which primary assets and plugins to package in a game build, for example based on a release number, to separate in-development and out-of-season game content from shipped content and to mitigate data mining. This tutorial includes an example project that demonstrates steps that Epic takes in Fortnite.*

## 


#### 

- [{'type': 'paragraph', 'content': 'The project\'s\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-management-in-unreal-engine#registeringandloadingprimaryassetsfromdisk">asset manager configuration</a>\xa0determines what asset types are considered\xa0<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-management-in-unreal-engine#primaryandsecondaryassets">primary assets</a>\xa0and which folders to scan for them.'}]
- [{'type': 'paragraph', 'content': 'The project\'s Packagings settings can specify "Additional Asset Directories to Cook": assets from these folders are always cooked regardless of their type.'}]
- [{'type': 'paragraph', 'content': 'Assets that are referenced by another included asset are also cooked. These are referred to as secondary assets.'}]


#### 


## 


## 


```

```


```

```

- [{'type': 'paragraph', 'content': '<code class="inline-code">ExampleReleaseVersion 1.0</code>: Includes only BP_ExampleActorA: a cylinder actor'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">ExampleReleaseVersion 2.0</code>: Also includes BP_ExampleActorB: a sphere actor'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">ExampleReleaseVersion 3.0</code>: Also includes BP_ExampleActorC: a cube actor'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">ExampleReleaseVersion 4.0</code>: Includes a game feature plugin that adds a "hat" (cone mesh) to all the above actors from the base game, via the "Add Components" Game Feature action.'}]


```

```


#### 


## 


## 


#### 


```

```

- [{'type': 'paragraph', 'content': 'Set\xa0<code class="inline-code">bOverrideBuildEnvironment = true;</code>\xa0to allow overriding build environment settings. Engine modules will be used from the engine\'s Intermediate folder. The potential benefit is that when developing multiple game projects, the engine doesn\'t need to be recompiled and engine Intermediate artefacts don\'t take up disk space multiple times. The downside is that when one of your game projects has different build environment settings, the engine may need to be recompiled. This may happen everytime you work on an Unreal project with different build environment configuration from the last compile.'}]
- [{'type': 'paragraph', 'content': 'Alternatively, set\xa0<code class="inline-code">BuildEnvironment = TargetBuildEnvironment.Unique;</code> to use a unique build environment. Engine modules will be uniquely compiled for the game project in the game project\'s Intermediate folder. Use this when having multiple game projects with different build environment settings to avoid excessive recompiling of engine source code. It will require you to fully compile the engine once for that game project and will result in more disk space usage.'}]


#### 


```

```


```

```


```

```


#### 


```

```


#### 


```

```


```

```


```

```


```

```


#### 


```

```


## 


#### 


```

```


#### 


```

```


#### 


```

```


#### 

- [{'type': 'paragraph', 'content': 'For each asset: the designer configured version range'}]
- [{'type': 'paragraph', 'content': "The target release version of the build we're cooking for"}]


```

```

- [{'type': 'paragraph', 'content': "If we're cooking a large project, it would be immensely slow to load each asset and its dependencies just to decide whether to cook it. Ideally, we don't load assets unless we cook them and until we decide to cook them."}]
- [{'type': 'paragraph', 'content': 'To access class specific properties would create a dependency from our asset manager class on each of the asset classes. This in turn is bad because it introduces module dependencies and is incompatible with yet-unknown class types.'}]

- [{'type': 'paragraph', 'content': 'A property can be marked <code class="inline-code">UPROPERTY(AssetRegistrySearchable)</code> which lets engine code know to automatically store that property\'s value as an asset registry tag. Conversion to a string value is handled by the property type\'s override of <code class="inline-code">FProperty::ExportText(...)</code>.'}]
- [{'type': 'paragraph', 'content': 'Any <code class="inline-code">UObject</code> class can override <code class="inline-code">UObject::GetAssetRegistryTags(...)</code> to store custom key-value pairs.'}]


```

```


```

```


```

```


```

```


#### 


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


#### 


```

```


```

```


#### 


```

```


```

```


```

```


#### 


```

```


## 

- [{'type': 'paragraph', 'content': 'Version retrieval from environment variables and config files in C# target files and C++ game code.'}]
- [{'type': 'paragraph', 'content': 'Target files enumerating plugins in a future-proof way by scanning for plugin descriptors and processing custom values in those descriptor files.'}]
- [{'type': 'paragraph', 'content': 'Asset manager processing assets without knowing their class or loading their objects, by having assets store their version info as asset registry tags.'}]
- [{'type': 'paragraph', 'content': 'Game feature plugins as a way to augment base game content and including those plugins based on game version.'}]

- [{'type': 'paragraph', 'content': 'Target files enforcing that optional plugins are disabled by default.'}]
- [{'type': 'paragraph', 'content': 'UObject classes implementing their own PreSave check to avoid being cooked.'}]
- [{'type': 'paragraph', 'content': 'Avoiding serializing map actor instances whose class is excluded from cook.'}]

- [{'type': 'paragraph', 'content': 'When you exclude primary assets from cooking, especially using cook rule <code class="inline-code">NeverCook</code>, references from included assets to those excluded assets break. You may want to implement editor-time and cook-time validation to catch that as soon as possible.'}]
- [{'type': 'paragraph', 'content': 'If your goal is data mining mitigation, more steps should be taken to avoid cooking secondary assets and\xa0serializing class instances, references and names. In Fortnite our build machines have build jobs that data mine build artefacts (assets, executables, pak files, iostores) to catch blocked keywords.'}]