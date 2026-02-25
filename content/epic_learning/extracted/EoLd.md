# Tech Note: Crash in Control Rig VM due to memory stomping

*Article written by Euan C. 
Summary: A Control Rig VM crash has been found in non-editor builds due to a memory stomping issue. The issue reproduces as a fatal log in FMallocBinned2::GetAllocationSizeExternal(): “FMalloc…*

