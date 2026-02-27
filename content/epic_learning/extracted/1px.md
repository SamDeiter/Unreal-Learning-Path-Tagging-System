# The EOS Online Subsystem (OSS) Plugin

*This course is a walkthrough for integrating and using the Epic Online Services (EOS) Online Subsystem (OSS) plugin in Unreal Engine. The course was written for UE 5.1, though the code should work in future versions of UE, in UE 5.0 and in UE4.27.*


## Introduction

This is the introduction to the EOS Online Subsystem (OSS) Plugin course.


# Introduction

This course is a walkthrough on integrating and using the EOS Online Subsystem (OSS) plugin in Unreal Engine. The course was written using UE 5.1 though the code should work in future versions of UE and will work in older versions up to UE4.27. If you are using P2P, you should use UE 5.3 which is bundled with EOS SDK version 1.16. Or, you should upgrade the EOS SDK version to older versions of UE due to this WebRTC vulnerability. This course does not go into the EOSPlus OSS plugin*. The approach presented in this course is a simple, straightforward approach. For an actual game, you may want to investigate different approaches to designing your code for accessing the Online Subsystems. For example, the Lyra project uses a custom-built plugin called CommonUserSubsystem. If you want to learn more about Lyra and how it uses EOS, we have this awesome tutorial: Using Epic Online Services with Lyra Starter Game.All code in this course is meant to be used for educational purposes only. Code used in production (in a real game) should be reviewed by peers, modified as needed and gone through thorough testing (QA).

This course will be released in several parts. The course currently has the following sections:

- Configuring the plugin
- Signing into EOS using an Epic Games Account
- Creating an EOS Session on a dedicated server
- Finding and joining the EOS Session on the dedicated server from game clients.
- EOS Stats, Achievements and Leaderboards
- EOS Player and Title Storage Data
- EOS P2P, Lobbies and Voice
- - NEW - EOS Sanctions
The authors of this course decided to release this course in several parts to get  content out ASAP, while the course is being continuously worked on.The code for this tutorial is available on GitHub. * The EOSPlus OSS plugin combines EOS and another platform (Steam, console platform, etc.). EOSPlus stands for EOS + base platform. If you ship your game on the Epic Games Store, you will likely use the EOS OSS plugin. You use the EOSPlus OSS plugin if you ship your game on another platform. There are exceptions to this.


## References

Each course module will have a reference section that will be precise to the course module. The list of references here is the general documentation for the EOS SDK, the plugin and the GitHub repo with the source code.

- Epic Developer Resources Documentation
- The EOS Online Subsystem (OSS) Plugin
- GitHub Repo

# Prerequisites

This course is designed to target an audience that is of a beginner level with the Unreal Engine [UE] Online Subsystem. That being said, the course does assume the student has a certain knowledge of C++ and Unreal Engine. It also assumes the student has configured an Epic Online Service [EOS] product in the Developer Portal. This course does not introduce you to the Unreal Engine, but to the Epic Online Services Online Subsystem. Specifically, this course assumes:

- You have configured an organization and product in the EOS developer portal. You have configured a client and client policy for your product.  To get started with this, please refer to the Developer Portal documentation.
- You have basic knowledge of C++ and the C++ package installed in Visual Studio. Note: you need to use Visual Studio and not Visual Code.
- Note: you need to use Visual Studio and not Visual Code.
- You have installed UE from the Epic Games Launcher (binary build). Or, you have pulled the UE code from GitHub or Perforce and built the engine (source build).
- You have a basic understanding of game development in UE.Concepts specific to UE and unrelated to EOS aren’t explained in depth.
- Concepts specific to UE and unrelated to EOS aren’t explained in depth.
- Programming & Scripting
- Games
- c++
- plugins

## Course Lessons (12 total)

- Introduction
- Plugin Configuration
- Signing-in
- Setting up a dedicated server to host EOS Sessions
- Join EOS Session
- EOS Stats, Achievements and Leaderboards
- EOS Player and Title Data Storage
- EOS P2P, Lobbies and Voice
- EOS Sanctions
- EOS Player Reports
- Epic Games Store Ecommerce
- Conclusion