# Batch Rendering with Command-Line

*Batch Rendering with Command-Line with Movie Render Queue*

### 


## 


```

```

- [{'type': 'paragraph', 'content': 'Log pops up another window to monitor the engine’s output even when we don’t have the editor. This can also be used to export to a specific file (ex -log=filename.log)'}]

- [{'type': 'paragraph', 'content': 'Unattended allows us to bypass any part of the engine that requires user input such as dialogs that might pop-up and block the Engine.'}]

- [{'type': 'paragraph', 'content': 'ExecutePythonScript specifies the path to a python file to be run. In this approach, the full Unreal Editor launches, opens your specified project, loads the default startup level, then runs your script once everything is loaded and ready. Note: ExecutePythonScript waits for the asset registry to load before running, so for large projects you may see a delay where the editor has loaded and is interactive but won’t execute your script until it’s finished processing the registry which happens asynchronously.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Note: </b>ExecutePythonScript waits for the asset registry to load before running, so for large projects you may see a delay where the editor has loaded and is interactive but won’t execute your script until it’s finished processing the registry which happens asynchronously.\xa0'}]]}]


## 


```

```


###