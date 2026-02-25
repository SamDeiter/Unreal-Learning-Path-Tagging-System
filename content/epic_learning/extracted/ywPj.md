# Setting up Horde Distribution for CI/CD and more

*An introduction to setting up Horde*

### 


#### 


#### 


#### 


### 


#### 

- [{'type': 'paragraph', 'content': '<b><a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/using-perforce-as-source-control-for-unreal-engine">Perforce Source Control</a>; </b>at this point in time Horde is only supported with Perforce, read more about Perforce source control and unreal here\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Unreal Engine 5.4+</b>; whilst Horde can work with earlier versions of Unreal Engine with some configuration by the user, this guide is written for 5.4+\xa0'}]
- [{'type': 'paragraph', 'content': '<b>Willingness to use <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/buildgraph-for-unreal-engine">BuildGraph</a></b>- Unlike other CI/CD solutions, Horde uses BuildGraph for all its steps, meaning that if you already have existing pipelines not using BuildGraph then you will need to convert them over'}]
- [{'type': 'paragraph', 'content': '<b>Using Unreal Engine Source build;</b> Horde was designed to use Unreal Engine source builds and does not support launcher builds.\xa0'}]
- [{'type': 'paragraph', 'content': "<b>This tutorial assumes you're working on a Windows machine</b>; see the documentation for more details on Linux and Mac workflows. This guide will still be a very solid reference.\xa0"}]


#### 


#### 


```

```


```

```


### 


```

```

- [{'type': 'paragraph', 'content': 'Go to Tools &gt; Options.'}]
- [{'type': 'paragraph', 'content': 'Search for JSON.'}]
- [{'type': 'paragraph', 'content': 'Select Schema.'}]
- [{'type': 'paragraph', 'content': 'Add the Schema URL from your Horde server.'}]


### 


#### 

- [{'type': 'paragraph', 'content': '<a href="https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Programs/Horde/Docs/Deployment/ServerSettings.md">Server.JSON</a>: Always on the server, this one sets up configurations on your server operation, such as your database URLS, Auth modes, and your Global.JSON location.\xa0'}]
- [{'type': 'paragraph', 'content': '<a href="https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Programs/Horde/Docs/Config/Schema/Globals.md">Global.JSON</a>: controls all the user-facing elements of the system once deployed. Defines what \'Projects\' to show in the Horde Dashboard, configure Horde plugins, storage settings and ACL.\xa0Most configuration after setting up deployment parameters is done here.'}]
- [{'type': 'paragraph', 'content': '<a href="https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Programs/Horde/Docs/Config/Schema/Projects.md">*project.JSON:</a>\xa0Defines configuration for a "Project" in this case a project could be a Game project you\'re working on with multiple streams within it, such as release. You can define What Streams are inside this project, the project title and the header banner graphics in this file.\xa0'}]
- [{'type': 'paragraph', 'content': '<a href="https://github.com/EpicGames/UnrealEngine/blob/release/Engine/Source/Programs/Horde/Docs/Config/Schema/Streams.md">*.stream.JSON</a>: Where we define categories and jobs for our CICD, the bulk of our configurations will end up in here on a per project / per stream basis.\xa0'}]


#### 


##### 


```

```


##### 


```

```


##### 


```

```


#### 


##### 

- [{'type': 'paragraph', 'content': 'Download and install the Horde Agent (Windows Installer) on the target machine.'}]
- [{'type': 'paragraph', 'content': 'Once installed, the Agent will attempt to connect to the server.'}]
- [{'type': 'paragraph', 'content': 'Go to Server &gt; Agents in the Dashboard to approve the enrollment.'}]


###### 

- [{'type': 'paragraph', 'content': '<b>As a Service: </b>Runs in the background. Great for compiling code or cooking content. Cannot open the Editor GUI or run tests that require a window.'}]
- [{'type': 'paragraph', 'content': '<b>As a User</b> (Interactive): Runs as a console application. Required for running automation tests that need to launch the game or editor window.'}]


#### 


### 


#### 

- [{'type': 'paragraph', 'content': 'Nightly Builds: Run a full package and test every night at 3 AM.'}]
- [{'type': 'paragraph', 'content': 'Per-Change Builds: Trigger a compile every time code is submitted (Continuous Integration).'}]


#### 


```

```

- [{'type': 'paragraph', 'content': 'MaxActive: The maximum number of builds of this type that can run at once.'}]
- [{'type': 'paragraph', 'content': 'MaxChanges: How far behind the head revision the schedule can fall.'}]
- [{'type': 'paragraph', 'content': 'Filter: A highly useful setting that lets you filter triggers based on file types. For example, ["ContainsCode"] ensures the build only triggers if C++ or build files were modified, ignoring simple asset changes.'}]
- [{'type': 'paragraph', 'content': 'Interval: How often (in minutes) Horde checks for changes.'}]


### 


#### 


#### 

- [{'type': 'paragraph', 'content': 'Locate Build/UnrealGameSync.ini in your project or engine source.'}]
- [{'type': 'paragraph', 'content': 'Add your Horde URL:'}]


```

```


#### 

- [{'type': 'paragraph', 'content': 'In Horde, ensure you have an Incremental Build job configured (this comes with the default examples).'}]
- [{'type': 'paragraph', 'content': 'This job compiles the editor and uploads the binaries as artifacts.'}]
- [{'type': 'paragraph', 'content': 'Once the job completes for a changelist, UGS will see the artifacts and allow users to sync and run without compiling locally.'}]


### 


#### 


### 

- [{'type': 'paragraph', 'content': 'Download the extension from <b>Tools &gt; Downloads</b>.'}]
- [{'type': 'paragraph', 'content': 'Once extracted, Configure the P4VUtils.ini file to point to your Horde URL.'}]
- [{'type': 'paragraph', 'content': 'Run "P4VUtils.exe install". from the command line'}]


```

```


### 


### 


#### 

- [{'type': 'paragraph', 'content': 'Go to the Devices tab in Horde.'}]
- [{'type': 'paragraph', 'content': 'Add a device using its IP address (e.g., for Android ADB over Wi-Fi) or network address.'}]


#### 


```

```


#### 

- [{'type': 'paragraph', 'content': '<a href="https://www.google.com/search?q=https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-system-overview">Unreal Build Tool (UBT) Tests</a>:\xa0\xa0\xa0You can write C++ automation tests that run on the device.'}]
- [{'type': 'paragraph', 'content': '<a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/functional-testing-in-unreal-engine">Blueprint Functional Testing</a>:\xa0\xa0\xa0You can create functional tests\xa0 entirely in Blueprint making them very accessible.'}]


### 


#### 


#### 


```

```


```

```


### 


#### 


#### 


```

```