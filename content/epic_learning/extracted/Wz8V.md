# Intuitive material building with the UI Material Lab - Part 1

*An artist and beginner friendly approach to building 2D materials using the functions and examples provided in the UI Material Lab collection.
Part 1 gives you an introduction and shows you how to get and use the project. It also gives you some base knowledge of materials to ensure you can understand and use the material functions provided.*

### 


### 


### 

- [{'type': 'paragraph', 'content': '2D/UI artists at the start of their material journey'}]
- [{'type': 'paragraph', 'content': 'Designers willing to get their hands dirty in the engine'}]
- [{'type': 'paragraph', 'content': 'Small devs, solo devs, who need quick ways of getting some cool UI in'}]
- [{'type': 'paragraph', 'content': 'People who already work with materials but want to build a library of reusable functions and speed up their workflow'}]


### 

- [{'type': 'paragraph', 'content': 'It’s <strong><em>not\xa0</em></strong>an explanation of the most basic things (what is a Lerp? what is a Smoothstep?)'}]
- [{'type': 'paragraph', 'content': 'It’s <strong><em>not\xa0</em></strong>a collection of big and complex materials'}]
- [{'type': 'paragraph', 'content': "it's <strong><em>not\xa0</em></strong>made of hyper specific functions that you won't use more than once or twice in your life"}]


### 

- [{'type': 'paragraph', 'content': '<mark>Educational</mark>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'for folks who would like to learn more about materials and common material techniques'}], [{'type': 'paragraph', 'content': 'put beginners on the path to success'}]]}]
- [{'type': 'paragraph', 'content': '<mark>Library/Reference</mark>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'for peeps who already work with materials'}], [{'type': 'paragraph', 'content': 'to provide example content, handy material functions, remember stuff you forgot, check out if there are other ways of doing things you already do.'}]]}]
- [{'type': 'paragraph', 'content': '<mark>Inspiration</mark>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'to give new ideas to artists and designers'}], [{'type': 'paragraph', 'content': 'provide inspiration for everyone to try out something different'}], [{'type': 'paragraph', 'content': 'give a sense of what we can do in Unreal Engine'}]]}]


### 


### 

- [{'type': 'paragraph', 'content': '<mark>Material Functions</mark> contains the the heart of the UI material Lab: all the material functions, grouped by type'}]
- [{'type': 'paragraph', 'content': '<mark>Materials\xa0</mark>contain all the examples that you see when you Play In Editor, and the folder structure follows the tabs'}]
- [{'type': 'paragraph', 'content': '<mark>Widgets\xa0</mark>contains the widgets that are used to show the UI Material Lab, both the structural widgets (tabs, cards, ...) and some applications'}]


### 

- [{'type': 'paragraph', 'content': 'Go to the <strong>Materials\xa0</strong>folder'}]
- [{'type': 'paragraph', 'content': 'Navigate to the correct <strong>subfolder\xa0</strong>according to the\xa0<strong>tab</strong>'}]
- [{'type': 'paragraph', 'content': 'Find the effect <strong>folder\xa0</strong>according to its\xa0<strong>name</strong>'}]
- [{'type': 'paragraph', 'content': 'Open the corresponding <strong>Material\xa0</strong>and <strong>Material Instance</strong>'}]


### 

- [{'type': 'paragraph', 'content': 'Create or open a Material'}]
- [{'type': 'paragraph', 'content': "The Material should be a UI Material, otherwise some of the functions won't work"}]
- [{'type': 'paragraph', 'content': '<strong>Right Click </strong>or press <strong>Tab </strong>to bring up the list of functions'}]
- [{'type': 'paragraph', 'content': "Under the dropdown <em>UI Material Lab</em> you'll find all the available material functions"}]
- [{'type': 'paragraph', 'content': 'Click on the function you want to add it to the graph'}]


### 


### 

- [{'type': 'paragraph', 'content': 'Select the <strong>UIMaterialLab\xa0</strong>folder'}]
- [{'type': 'paragraph', 'content': 'Right click and and select <mark>Migrate...</mark>'}]
- [{'type': 'paragraph', 'content': 'Choose which content you want to migrate: you might want to move only the <strong>MaterialFunctions\xa0</strong>folder'}]
- [{'type': 'paragraph', 'content': 'Choose the destination folder: it should be the <strong>Content\xa0</strong>folder in your project'}]
- [{'type': 'paragraph', 'content': 'Let the process complete and verify the assets have been migrated correctly'}]


## 

- [{'type': 'paragraph', 'content': "don't rely too much on the instruction count shown in the material editor: an instruction is just an operation, and different operations can take up a different amount of GPU cycles and register usage"}]
- [{'type': 'paragraph', 'content': 'texture sampling can be quite expensive so consider using SDFs and gradients Material Functions if possible'}]
- [{'type': 'paragraph', 'content': 'the material runs for every pixel of the widget you want to render, so the bigger the size the of widgets, the more times the same material will have to run, so be extra thoughtful with fullscreen effects'}]
- [{'type': 'paragraph', 'content': 'as a reference here are some different degrees of ALU instructions (arithmetic operations) complexity (can vary with different GPU architectures):'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'FREE (on most GPUs)'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'saturate, abs, multiply by 2/4, divide 2/4 (Indeed, some hardware instructions can receive modifiers on their inputs or outputs like "multiply output by 2")'}]]}], [{'type': 'paragraph', 'content': 'CHEAP TIER'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'add, subtract, multiply, min, max, floor, ceil, round, frac'}], [{'type': 'paragraph', 'content': 'clamp, step, lerp, dot product'}], [{'type': 'paragraph', 'content': 'if (aka branchless ternary comparison)'}]]}], [{'type': 'paragraph', 'content': 'MID TIER'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'divide, sin, cos, square root, log2, exp2'}], [{'type': 'paragraph', 'content': 'sign, cross product, length'}], [{'type': 'paragraph', 'content': 'distance, smoothstep'}]]}], [{'type': 'paragraph', 'content': 'EXPENSIVE TIER'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'power, fmod, tan'}], [{'type': 'paragraph', 'content': 'inverse trigonometry (asin, acos, atan, atan2)'}]]}]]}]
- [{'type': 'paragraph', 'content': "values passed as constants (not parameters) will be optimized at compile time (so don't worry about Multiply by 0.5 Vs Divide by 2, it's the same thing if they're constants)"}]
- [{'type': 'paragraph', 'content': "use <strong>Custom\xa0</strong>nodes only if needed (e.g. for operations that are not available in node form): they don't get optimized at compile time the same way nodes are, you can't preview all the steps and they might not be very easy to understand for your teammates"}]


## 


#### 


####