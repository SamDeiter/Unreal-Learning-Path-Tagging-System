# Tech Note: Fix for PSO Management Issue on Nvidia Hardware in Unreal Engine 5.5

*A critical stability issue has been identified in Unreal Engine versions 5.5 and above, affecting projects running on Nvidia hardware, particularly with recent driver versions. This post describes a way to integrate a fix for this issue.*

### 


### 

- [{'type': 'paragraph', 'content': '✅ Affected: All point releases of Unreal Engine 5.5'}]


### 


### 


### 


### 

- [{'type': 'paragraph', 'content': 'Apply the <i>pso-fix.patch</i> file via your preferred code patching utility.'}]
- [{'type': 'paragraph', 'content': 'After integration, rebuild your full project to apply changes.'}]


### 

- [{'type': 'paragraph', 'content': 'Rebuild your project completely.'}]
- [{'type': 'paragraph', 'content': 'Launch your project on affected Nvidia hardware with recent drivers installed.'}]
- [{'type': 'paragraph', 'content': 'Monitor stability during startup and runtime PSO usage (e.g., scene transitions or FX-heavy gameplay).'}]
- [{'type': 'paragraph', 'content': 'Confirm that the previous instability no longer occurs.'}]


### 


###