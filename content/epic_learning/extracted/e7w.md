# Neural Network Engine (NNE)

*In this course you will learn everything needed to empower your game with AI using Unreal Engine's neural network engine NNE.*


## NNE - Overview - 5.3

Learn about the NeuralNetworkEngine (NNE) ecosystem, its interfaces and how it can be used to run neural networks inside your game.


# NNE - Overview - 5.3

This tutorial is about NNE as it has been released with Unreal Engine 5.3. If you are working with UE 5.2, please refer to this tutorial instead.


## Introduction

There are many neural network inference engines out there. Some of them target specific hardware, some are optimised for certain models and some try to cover as much as possible at the cost of efficiency for each. Unreal Engine's NNE provides an API to access different such implementations in a common way, allowing programmers to easily switch between them on demand to optimally cover their use case and target platform. You can think of NNE as something similar to UE's RHI: While RHI abstracts from different graphics runtimes (DirectX, Vulkan, ...) NNE's purpose is to abstract from different inference runtimes.

In a game engine there is the need for more special use cases than just the traditional fire-and-forget inference. Example given, a neural network needs to run aligned with the rendering of a frame to be able to consume frame resources as input and generate output that can be consumed further down the render pipeline. To cover these cases and be flexible enough to cover future use cases too, each runtime in NNE is accessed through one or more interfaces, with each interface corresponding to a specific workflow.

To use NNE, you need to enable the NeuralNetworkEngine plugin as well as the plugins for each runtime that you intend to use.


## Runtimes


### List All Runtimes

At the core of NNE is the runtime registry. When you enable the plugin of a runtime, the runtime will be registered at startup with the registry making it accessible by the application. At the same time, NNE asset importing is enabled. You can query all available runtimes of the currently running platform by calling the global function


```
TArrayView< TWeakInterfacePtr< INNERuntime > > UE::NNE::GetAllRuntimes();
```

Note: In the editor, runtimes may be listed which are not able to run inference on the current platform but need to be present to be able to cook content when a game is packaged for a different platform. Also note, that the results of registry functions are weak pointers to allow the runtimes to be in control of their own unloading. Thus the weak pointer should be tested for validity by calling the function


```
bool TWeakInterfacePtr::IsValid();
```

before using it.

You can then query the name of each runtime with the function


```
FString INNERuntime::GetRuntimeName();
```


### Select The Runtime Interface

As mentioned, each runtime implements one or more interfaces. Each interface covers a different kind of use case and how inference is done. To figure out which interface is suitable for your specific use case, ask yourself whether it needs to run on CPU or GPU and if on GPU, whether it runs in-editor only and independent of the render pipeline or if it needs to run aligned with a rendered frame. The choice between the following interfaces depends on your answers to above questions.

INNERuntimeCPU: This interface will allow you to run inference on CPU working on in- and outputs provided in CPU memory. There are runtimes for this interface available that support in-editor or also in-game inference. Inference can run both synchronously on the game thread (if the model is small enough to fit your budget) or inside an asynchronous task in the background. This is the simplest interface and always a good point to start with.

INNERuntimeGPU: INNERuntimeGPU can be used in-editor only and when GPU inference can be done independent of the rendered frames. It takes CPU in- and output, but up- and downloads it to and from the GPU where the inference takes place. It is not meant to perform real-time tasks as implementing runtimes may compete with the UE render pipeline. It is typically used to perform in-editor asset actions like queries, comparisons, creation or conversions.

INNERuntimeRDG: This runtime is used to run frame aligned inference, potentially working on render resources that are created or consumed while a frame is rendered. It needs a FRDGBuilder to be enqueued to and thus requires some knowledge about the render graph builder of the Render Dependency Graph to be used.

Once you know the interface you need, you can try to cast any INNERuntime to that interface to see if that particular runtime implements the given interface:


```
TWeakInterfacePtr< T > Interface = TWeakInterfacePtr< T >(Cast< T >(Runtime.Get()));
```

The resulting weak pointer will be invalid if the runtime does not support the interface T.


### Select The Runtime Implementation

Besides the interface you also need to determine which runtime implementation to use. Not every runtime is available on all platforms, so you want to figure out which runtimes run on the platforms on which you intend to ship your application. Also, not all runtimes support all models, so you need to test your model on each runtime to filter out incompatible ones (or adapt your model so it becomes compatible). You can use some game logic and preprocessor directives to select different runtimes on different platforms.

When you know the name of the runtime and the interface that you are interested in, you can use the global registry function


```
TWeakInterfacePtr< T > UE::NNE::GetRuntime< T >(const FString& Name);
```

to get the runtime. The weak pointer is invalid if the runtime is either not available or it does not support the interface passed as template argument T.


## Assets

Neural network models are stored as assets so that they can be optimized for a given runtime and target platform at cook time. While currently all runtimes support the Open Neural Network Exchange format (.onnx) this is not mandatory and each runtime can theoretically support its own file format(s).

To import a model, you need to export it from your training framework in a file format that your selected runtime supports. Then simply drag and drop it inside the content window of the Unreal Engine editor and it will create a UNNEModelData asset (if the file extension is supported by any of the enabled runtime plugins).

Double click the asset to specify on which runtimes you intend to use it (Note, only enabled runtimes will be listed). This will prevent the model from being cooked for runtimes not needed and thus will reduce the package size of your packaged application. Like this you can also prevent NNE from trying to cook a model for runtimes that do not support it. By default, models will try to cook for all runtimes.

NNE assets can be loaded the same way as other Unreal Engine assets. If the neural network is part of an actor, you can define a public class variable of type UNNEModelData with the UPROPERTY decorator inside the actor and simply select or drag and drop the NNE asset to the actor inside the editor. If the content path is known, the UE function LoadObject can be used to load the asset programmatically. Usage of TSoftObjectPtr is possible as well.


## Models

A neural network model can be created by passing a UNNEModelData reference to the CreateModel function of a runtime. The created model typically contains all the read only data that is shared across different inference sessions and model instances (e.g. the model weights). To run inference, some intermediate buffers may be required in addition to the shared data defined inside the model. Thus, models typically offer a function CreateModelInstance to create a model instance that contains this additional data. Inference can then be run on each individual instance.

A caller must make sure that calls to a model instance must be thread safe. In specific, only a single thread may run inference at the same time on a single instance. For concurrent calls where batching is not possible, multiple instances from the same model can be created without duplicating the shared weights and inference on each instance can be done concurrently.

Note, each NNE interface creates models and model instances with different and specialized functions to run inference. Please refer to the corresponding tutorials to figure out how exactly to invoke inference.

Also note that input and output data passed to model instances for inference are owned by the caller and thus the corresponding memory must survive any invoked inference.


## Minimal Code Example

The following code snippet assumes that an UNNEModelData has been imported to the content path /path/to/asset. It further assumes properly allocated variables InputShapes, Inputs and Outputs.

First, a reference to an UNNEModelData asset is retrieved by calling LoadObject. Any other way to get a reference to a valid asset (e.g. an asset assigned to a UPROPERTY class member of an actor) will work too. Then, we get a runtime with the name NNERuntimeORTCpu that implements the INNERuntimeCPU interface. The asset is then passed to the runtime in the call CreateModel to create a model. On the returned model CreateModelInstance is called to create a model instance on which inference can be run. SetInputShapes needs to be called on the model instance to give it the chance to allocate required internal buffers. The model is then evaluated with a call to RunSync passing caller-owned input and output buffers.


```
// Create the model from a neural network model data assetTObjectPtr<UNNEModelData> ModelData = LoadObject<UNNEModelData>(GetTransientPackage(), TEXT("/path/to/asset"));TWeakInterfacePtr<INNERuntimeCPU> Runtime = UE::NNE::GetRuntime<INNERuntimeCPU>(FString("NNERuntimeORTCpu"));TUniquePtr<UE::NNE::IModelInstanceCPU> ModelInstance = Runtime->CreateModel(ModelData)->CreateModelInstance(); // Prepare the model given a certain input sizeModelInstance->SetInputTensorShapes(InputShapes); // Run the model passing caller owned CPU memoryModelInstance->RunSync(Inputs, Outputs);
```

Checks on results have been omitted here for simplicity but would be required for production code.


## Next Steps

Learn more details on how to run a model on CPU in the NNE - Quick Start Guide - 5.3.

- Pipeline & Plugins
- Programming & Scripting
- Games
- Film & TV
- Architecture
- Visualization
- machine learning
- nne
- neural network
- deep learning

## Course Lessons (3 total)

- NNE - Overview - 5.3
- NNE - Quick Start Guide - 5.3
- NNE - Neural Post Processing