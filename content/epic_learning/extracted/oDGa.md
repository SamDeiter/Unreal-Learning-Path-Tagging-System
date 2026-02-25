# Tech Note: Regression in editor performance in D3D11

*Article written by Matt O. 
Description 
In D3D11Commands.cpp, we are resolving the debug uniform buffer layout name to an FName instance, which is very expensive. This gets compiled out in test builds, however. 
Potenti…*

