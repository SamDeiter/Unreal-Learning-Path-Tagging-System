# Learning Agents (5.5)

*Get familiar with Learning Agents: a machine learning plugin for AI bots. Learning Agents allows you to train your NPCs via reinforcement & imitation learning. It can be used to create game-playing agents, physics-based animations, automated QA bots, and much more!*


## Learning Agents (5.5)

A brief intro to Learning Agents: a machine learning plugin for AI bots. Learning Agents allows you to train your NPCs via reinforcement & imitation learning. It aims to be useful in the creation of game-playing agents, physics-based animations, automated QA bots, and much more!

Learning Agents is an experimental plugin. Use caution when deciding to develop a game with it.


### What is Learning Agents?

Learning Agents is an Unreal Engine (UE) plugin that allows you to train AI characters using machine learning (ML). This enables you to augment or replace traditional game AI, such as those written with behavior trees or state machines. In particular, the plugin allows you to use reinforcement (RL) and imitation learning (IL) approaches. In the long term, Learning Agents aims to be useful in a range of applications, including game-playing NPCs, physics-based animations, and automated QA testing, etc.

Learning Agents is not a general purpose ML framework.  Each aspect of the plugin has been created with character decision-making in mind, so you wouldn't use Learning Agents for the following:

- Generative AI - images, audio, levels, 3D assets, etc.
Generative AI - images, audio, levels, 3D assets, etc.

- Chatting with NPCs
Chatting with NPCs


### Who is Learning Agents for?

Learning Agents is foremost for game developers, especially those who would be writing AI bots. We created this plugin with the intention of making it much more feasible for developers to train and deploy ML bots in their new or existing games. Developers at all familiarity levels with machine learning should find the plugin beneficial.


### Beginners

We have worked towards exposing the plugin's API to UE's blueprint system and agents can be trained using an existing Proximal Policy Optimization (PPO) reinforcement learning algorithm, as well as a Behavior Cloning (BC) imitation learning algorithm. Our intention is that it should be entirely possible to build a small demo into an indie game quickly.


### Experts

We created the plugin's C++ API with flexibility and performance in mind. Our goal is that you can get up to speed quickly by leveraging our provided implementations, but that you won't be limited by these. The plugin is designed like a library and not a framework, so you can take control of most aspects of how your agents train and do inference should your game require it.


### Researchers

Learning Agents provides a Python training process that should enable you to leverage tools you are most likely already familiar with such as PyTorch, Tensorboard, Numpy, etc. Out of the box components for communicating with the Unreal process should allow you to focus on your research problems and not on incidental issues.


### How does it work?

Learning Agents comes with both a C++ library (with Blueprint support) and Python scripts. The C++ library is an ordinary UE plugin split into a handful of modules. It exposes functionality for defining observations/actions and your neural network structure, as well as the flow-control for the training and inference procedures.  During training, the UE process will collaborate with an external Python process running PyTorch. We included a working PyTorch algorithm for PPO and BC.

We aim to make it possible to train with both a local and networked Python process, and have provided a couple communication protocols to enable each scenario. For scenarios where public privacy/security is required, we don’t currently have an appropriate solution.


### Getting Started

Get started with our learning how to drive tutorial here!

This is the 5.5 version of the Learning Agents course. The 5.4 version can be found here: https://dev.epicgames.com/community/learning/courses/kRm/unreal-engine-learning-agents-5-4/4JPj/unreal-engine-learning-agents-intro-5-4


### Questions & Feedback

For questions, issues, or feedback: please post on the forums and use the tag "learning-agents".

Thanks for your interest in Learning Agents!

- Character & Animation
- Programming & Scripting
- Games
- machine learning
- neural networks
- deep learning
- reinforcement learning
- imitation learning
- learning-agents

## Course Lessons (7 total)

- Learning Agents (5.5)
- What's New in Learning Agents? (5.5)
- Learning to Drive (5.5)
- Improving Observations & Debugging (5.5)
- Headless Training & Network Snapshots (5.5)
- Setting up Tensorboard
- Learning to Drive: Imitation (5.5)