# Learning Agents (5.3)

*Get familiar with Learning Agents: a machine learning plugin for AI bots. Learning Agents allows you to train your NPCs via reinforcement & imitation learning. It can be used to create game-playing agents, physics-based animations, automated QA bots, and much more!*


## Learning Agents Introduction (5.3)

A brief intro to Learning Agents: a machine learning plugin for AI bots. Learning Agents allows you to train your NPCs via reinforcement & imitation learning. It aims to be useful in the creation of game-playing agents, physics-based animations, automated QA bots, and much more!

Mac/Linux Issues: As Learning Agents is an experimental release, it is currently only supported on Windows.

This is the original 5.3 version of the Learning Agents tutorial. The latest 5.5 release version can be found here: https://dev.epicgames.com/community/learning/courses/GAR/unreal-engine-learning-agents-5-5/bZnJ/unreal-engine-learning-agents-5-5


# What is Learning Agents?

Learning Agents is an Unreal Engine (UE) plugin that allows you to train AI characters using machine learning (ML). This enables you to augment or replace traditional game AI, such as those written with behavior trees or state machines. In particular, the plugin allows you to use reinforcement (RL) and imitation learning (IL) approaches. In the long term, Learning Agents aims to be useful in a range of applications, including physics-based animations, game-playing NPCs, and automated QA testing, etc.

Learning Agents is not a general purpose ML framework.  Each aspect of the plugin has been created with character decision-making in mind, so you wouldn't use Learning Agents for the following:

- Generative AI - images, audio, levels, 3D assets, etc.
- Chatting with NPCs

# Who is Learning Agents for?

Learning Agents is foremost for game developers, especially those who would be writing AI bots. We created this plugin with the intention of making it much more feasible for developers to train and deploy ML bots in their existing or new games. Developers at all familiarity levels with machine learning should find the plugin beneficial.


## Beginners

We have worked towards exposing the plugin's API to UE's blueprint system and agents can be trained using an existing Proximal Policy Optimization (PPO) reinforcement learning algorithm, as well as a Behavior Cloning (BC) imitation learning algorithm. Our intention is that it should be entirely possible to build a small demo into an indie game quickly.


## Experts

We are designing the plugin with flexibility and performance in mind. Our goal is that you can get up to speed quickly by leveraging our provided implementations, but that you won't be limited by these. The plugin is designed like a library and not a framework, so you can take control of most aspects of how your agents train and do inference should your game require it.


## Researchers

Learning Agents provides a Python training process that should enable you to leverage tools you are most likely already familiar with such as PyTorch, Tensorboard, Numpy, etc. Out of the box components for communicating with the Unreal process should allow you to focus on your research problems and not on incidental issues.


# How does it work?

Learning Agents comes with both a C++ library (with Blueprint support) and Python scripts. The C++ library is an ordinary UE plugin split into a handful of modules. It exposes functionality for defining observations/actions and your neural network structure, as well as the flow-control for the training and inference procedures.  During training, the UE process will collaborate with an external Python process running PyTorch. We included a working PyTorch algorithm for PPO and BC.

We aim to make it possible to train with both a local and networked Python process, and have provided a couple communication protocols to enable each scenario. For scenarios where public privacy/security is required, we don’t currently have an appropriate solution.


# Current Limitations

- Support for other popular ML algorithms such as:
Soft Actor Critic
Q-Learning
- Soft Actor Critic
- Q-Learning
- More flexibility in Neural Network structure
CNNs
Memory inputs/outputs
- CNNs
- Memory inputs/outputs
- Training process communication that is secure and encrypted

# Getting Started

Check out the following tutorial to begin getting familiar with Learning Agents: Learning to Drive


# Questions & Issues

Thanks for your interest in Learning Agents! For questions or issues, please post on the forums and use the tag "Learning-Agents".

- Character & Animation
- Programming & Scripting
- Games
- machine learning
- neural networks
- deep learning
- agents
- reinforcement learning
- imitation learning
- learning agents

## Course Lessons (2 total)

- Learning Agents Introduction
- Learning to Drive