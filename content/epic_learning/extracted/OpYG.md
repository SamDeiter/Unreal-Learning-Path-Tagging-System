# Packaging Projects for nDisplay

*How to package and run standalone projects that run with nDisplay.*

### 


#### 

- [{'type': 'paragraph', 'content': 'Ensure that your nDisplay config is placed in the level you wish to run and is already setup with each of your nDisplay nodes.'}]
- [{'type': 'paragraph', 'content': 'Ensure that the nDisplay plugin is enabled <b><u class="cdx-underline">and</u></b> nDisplay is enabled in project settings (see project setting &gt; Plugins &gt; nDisplay). We recommend starting with one of the nDisplay template projects.'}]
- [{'type': 'paragraph', 'content': 'Ensure that the meshes used in the nDisplay config have "Allow CPU Access" enabled. Go to the static mesh editor for each mesh an enable "Allow CPU Access". This is essential for the meshes to be available in packaged games.'}]
- [{'type': 'paragraph', 'content': 'Package the project as Windows (64bit) - Shipping or Development.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Define the default map in Project Settings &gt; Game Default Map'}], [{'type': 'paragraph', 'content': 'Ensure you maps are included in your packaged build, go to: Packaging settings &gt; Advanced &gt; List of maps, and add your maps to the list.'}]]}]
- [{'type': 'paragraph', 'content': 'Launch and run the switchboard listener on each of the nDisplay nodes.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'This can be done via the desktop shortcut created when launching switchboard from the editor'}], [{'type': 'paragraph', 'content': 'Or if you wish to run without the editor installed you will need to get the listener from Engine\\Binaries\\Win64\\SwitchboardListener.exe and copy to all nDisplay nodes.'}], [{'type': 'paragraph', 'content': 'Or via the switchboard tool bar in the editor'}]]}]
- [{'type': 'paragraph', 'content': 'Run Switchboard from the machine you wish to launch from. Create a new switchboard config and <b><u class="cdx-underline">keep the uProject and Engine Dir blank</u></b>.'}]
- [{'type': 'paragraph', 'content': 'Add Device &gt; nDisplay &gt; browse to the nDisplay config. This can be found in the content folder of your project. If necessary you can copy the config actor asset to the packaged game content folder and reference it from there.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'To double check validity, ensure that the path in <b>Switchboard settings &gt; nDisplay settings &gt; the nDisplay Config File</b>\xa0is absolute path and valid for all machines.'}]]}]
- [{'type': 'paragraph', 'content': 'In the switchboard settings, under the "nDisplay Executable Filename" browse to the packaged game exe'}]
- [{'type': 'paragraph', 'content': 'Connect the devices'}]
- [{'type': 'paragraph', 'content': 'Launch nDisplay'}]