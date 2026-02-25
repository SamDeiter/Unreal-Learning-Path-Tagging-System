# Tech Note - [Bug] 4.26 D3D11 - Shader creation on multiple threads causes hitches

*Article written by Jon C. 
Description: The engine creates a minority of shaders on the task threads, but most of them are created on the rendering thread. This can interact poorly with NVidia driver heuristics, which ma…*

