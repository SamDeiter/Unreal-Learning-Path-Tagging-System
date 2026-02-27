# The Online Subsystem EOS Plugin - Epic Games Store Mobile

*This course walks you through the minimum EOS features needed for your game with in-app purchases for the Epic Games Store Mobile*


## Epic Games Store Mobile - The Online Subsystem EOS Plugin  -  Introduction and Project Setup

Module 1 of The Online Subsystem EOS Plugin - Epic Games Store Mobile course. Introduction and project setup.

The mobile Epic Games Store is currently in closed beta. We’re excited to launch our self-publishing tools in the near future.Interested in joining our mobile store? Submit your game through our Leads Intake form.

This tutorial shows the minimum steps required to ship your game on the mobile Epic Games Store. You’ll log into Epic Online Services, use Ecom to build an in-game store, and implement C++ functions that you’ll expose to Blueprints. The C++ is copy-and-paste ready, so you don’t need to be a C++ developer, just comfortable skimming the code to understand what it does.

The code for this tutorial is available on GitHub. If you're already comfortable with UE, C++ and Blueprints, you can pull the code and use it as a reference point for your game. This tutorial will provide developers with some information to help those new to UE, although it assumes the reader has some core UE knowledge.

At the end of this tutorial, you will have a minimal game based on our third-person starter template, where a player is logged into Epic Online Services, an in-game store is available to the player, the player can check out items, and the player can see items they own and are entitled to. The focus here is on EOS functionality; there are no game features or any art beyond what is provided in the starter template. The sample does not integrate an inventory service.


### Recording of Sample

Here is a recording of the end project taken on a Pixel Pro 9.


### Assumptions

This tutorial assumes:

- You have completed the setup in the Developer Portal. This tutorial only covers game-client code, not Developer Portal configuration. Specifically, you already have:Created an organization and productConfigured EOSConfigured Epic Account ServicesConfigured Client and Client Policy configurationEnabled your product for the Epic Games StoreCreated store offers
You have completed the setup in the Developer Portal. This tutorial only covers game-client code, not Developer Portal configuration. Specifically, you already have:

- Created an organization and product
Created an organization and product

- Configured EOSConfigured Epic Account ServicesConfigured Client and Client Policy configuration
Configured EOS

- Configured Epic Account Services
Configured Epic Account Services

- Configured Client and Client Policy configuration
Configured Client and Client Policy configuration

- Enabled your product for the Epic Games Store
Enabled your product for the Epic Games Store

- Created store offers
Created store offers

- You are using the new Ecom flow included in this commit.The code will be available in UE 5.8.You can backport it to older UE versions.
You are using the new Ecom flow included in this commit.

- The code will be available in UE 5.8.
The code will be available in UE 5.8.

- You can backport it to older UE versions.
You can backport it to older UE versions.

- You have a UE project set up for Android or iOS.The tutorial code doesn’t support iOS; current GitHub targets Android only.
You have a UE project set up for Android or iOS.

- The tutorial code doesn’t support iOS; current GitHub targets Android only.
The tutorial code doesn’t support iOS; current GitHub targets Android only.

- You have basic Unreal Engine knowledge:Comfortable to build for mobile platformsComfortable with Blueprints.Comfortable building UI widgets.Light familiarity with C++ (copy/paste + basic reading).
You have basic Unreal Engine knowledge:

- Comfortable to build for mobile platforms
Comfortable to build for mobile platforms

- Comfortable with Blueprints.
Comfortable with Blueprints.

- Comfortable building UI widgets.
Comfortable building UI widgets.

- Light familiarity with C++ (copy/paste + basic reading).
Light familiarity with C++ (copy/paste + basic reading).

- You have read through our Mobile Early Adopter documentation.
You have read through our Mobile Early Adopter documentation.


## Project Setup

This section guides you through the steps to set up your project. The project in this tutorial is also available on GitHub here.


### Create Project

Launch the Unreal Editor and create a C++ file using the Third Person template. Make sure to select mobile as the target platform:


### Enable OnlineSubsystemEOS plugin

Go to Edit → Plugins and enable the OnlineSubsystemEOS plugin. You will be prompted to restart the editor.

Once the editor has restarted, you will need to configure the plugin with your EOS configuration IDs. The tutorial assumes you have configured your EOS product and are somewhat comfortable navigating the developer portal. See our documentation on the Developer Portal and Getting Started guide for more information. Go to Edit → Project Settings.

Your \Config\DefaultEngine.ini should have the following configuration once the configuration is done in the UI. Note that you can bypass using the UI and update this file directly if you prefer. You will need to manually add the bUseNewEcomFlow to the file and set it to true.


```
[/Script/OnlineSubsystemEOS.EOSSettings]
CacheDir=CacheDir
DefaultArtifactName=ArtifactId
PlatformConfigName=
RTCBackgroundMode=
TickBudgetInMilliseconds=0
bEnableOverlay=True
bEnableSocialOverlay=True
bEnableEditorOverlay=False ;Overlay is not supported in editor
bPreferPersistentAuth=True
```


### Build.cs

In our Build.cs file (EOS_Example_Android.Build.cs), we need to add our OnlineSubsystem modules to the list of public modules.


```
using UnrealBuildTool;

public class EOS_Example_Android : ModuleRules
{
	public EOS_Example_Android(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "OnlineSubsystem", "OnlineSubsystemUtils", "OnlineSubsystemEOS", "Json"});
	}
```

Note: If you see reference issues with header files from any of the OnlineSubsystem modules, you will need to delete the Binaries and Intermediate folders, and regenerate Visual Studio project files:

- Games
- Film & TV
- Architecture
- Visualization
- Virtual Production

## Course Lessons (8 total)

- Epic Games Store Mobile - The Online Subsystem EOS Plugin  -  Introduction and Project Setup
- The Online Subsystem EOS - Epic Games Store Mobile - Player Controller C++
- The Online Subsystem EOS Plugin - Epic Games Store Mobile - Player Controller Blueprint
- The Online Subsystem EOS Plugin - Epic Games Store Mobile - Main HUD
- The Online Subsystem EOS Plugin - Epic Games Store Mobile - Store UI
- The Online Subsystem EOS Plugin - Epic Games Store Mobile - Entitlements UI
- The Online Subsystem EOS Plugin - Epic Games Store Mobile - Owned CatalogItems UI
- The Online Subsystem EOS Plugin - Epic Games Store Mobile - Conclusion