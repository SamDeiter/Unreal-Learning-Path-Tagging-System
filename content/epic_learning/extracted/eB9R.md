# Gathering Unreal Insights Traces on Android

*A step-by-step walkthrough for collecting Unreal Insights traces from a local Android device*

### 

- [{'type': 'paragraph', 'content': 'Create a UECommandLine.txt file to specify command line arguments:'}, {'type': 'code_snippet', 'description': '', 'snippet_type': 'shell', 'title': '', 'code_preview': '../../../MyProject/MyProject.uproject -tracehost=127.0.0.1 -trace=Bookmark,Frame,CPU,GPU,LoadTime,File -statnamedevents', 'lines_of_code': 1, 'id': 23044, 'url_signature': 'eyJzbmlwcGV0X2lkIjoyMzA0NCwidXJsX2V4cGlyZXNfYXQiOiIyMDI2LTAyLTI2VDIwOjM2OjU2KzAwOjAwIn0=--8ea322fa453da5afca83b588f501c5807f0594d431e3d7ff35d20852aa65f54a'}]
- [{'type': 'paragraph', 'content': 'Transfer UECommandLine.txt to the target device via adb:'}, {'type': 'code_snippet', 'description': '', 'snippet_type': 'shell', 'title': '', 'code_preview': 'adb push UECommandLine.txt /sdcard/Android/data/com.companyname.MyProject/files/UnrealGame/MyProject', 'lines_of_code': 1, 'id': 23045, 'url_signature': 'eyJzbmlwcGV0X2lkIjoyMzA0NSwidXJsX2V4cGlyZXNfYXQiOiIyMDI2LTAyLTI2VDIwOjM2OjU2KzAwOjAwIn0=--23cc1bf77251d84b8096c0f1c2628622fc188d4d30b635e7cd5214692452ad02'}, {'type': 'callout', 'callout_type': 'warning', 'blocks': [{'type': 'paragraph', 'content': 'Make sure you replace <code class="inline-code">com.companyname.MyProject</code> with your project\'s app identifier!'}]}]
- [{'type': 'paragraph', 'content': 'Enable a TCP reverse to allow the trace to be transferred back to your desktop:'}, {'type': 'code_snippet', 'description': '', 'snippet_type': 'shell', 'title': '', 'code_preview': 'adb reverse tcp:1980 tcp:1980', 'lines_of_code': 1, 'id': 23046, 'url_signature': 'eyJzbmlwcGV0X2lkIjoyMzA0NiwidXJsX2V4cGlyZXNfYXQiOiIyMDI2LTAyLTI2VDIwOjM2OjU2KzAwOjAwIn0=--54a396f4e61a95d3e15ee19553d1629fb0b7b129fe9bb27edc925e3b56b72006'}]


###