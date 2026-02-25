# Your First 60 Minutes with StateTree

*A practical guide to understanding and working with StateTree as it relates to AI. It covers key concepts, terminology, and execution flow for StateTree. This is accomplished while building a basic wildlife AI agent using the new StateTreeAIComponent.*

## 


## 

- [{'type': 'paragraph', 'content': 'StateTree'}]
- [{'type': 'paragraph', 'content': 'Gameplay StateTree'}]


## 


### 

- [{'type': 'paragraph', 'content': 'Fighting game button combo selectors'}]
- [{'type': 'paragraph', 'content': 'Animation selection'}]
- [{'type': 'paragraph', 'content': 'Quest logic'}]
- [{'type': 'paragraph', 'content': 'And yes, AI behaviors ;)'}]


### 

- [{'type': 'paragraph', 'content': '<b>Schema </b>- Sets up use-case specific data and can constrain or extend which nodes may be used with the StateTree'}]
- [{'type': 'paragraph', 'content': '<b>Context </b>- Data provided by the schema that is available to bind to for any task or condition'}]
- [{'type': 'paragraph', 'content': '<b>Parameters </b>- Additional data defined by the user for use in the StateTree. When assigning an instance of a StateTree asset, such as in StateTreeComponent or running a linked StateTree asset, users can provide custom values to be used for the parameters.'}]
- [{'type': 'paragraph', 'content': '<b>Global Task</b> - Tasks that run for the lifetime of the StateTree. These can be useful in exposing external data to the tree, configuring event listeners, and cleaning up the tree when stopping.'}]
- [{'type': 'paragraph', 'content': '<b>Evaluator </b>- These have largely been phased out in favor of using Global Tasks. Global Tasks handle the same uses as Evaluators.'}]
- [{'type': 'paragraph', 'content': '<b>Property Categories</b> - Metadata used for properties in tasks and conditions to allow binding data to task inputs and outputs. The categories currently used are:'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>Context </b>- Will automatically try to bind to best-fitting Context data but can be overridden to other data'}], [{'type': 'paragraph', 'content': '<b>Input </b>- Property passed into a task/condition that must be bound for the StateTree to compile. Other public properties may accept bindings, but they are seen as optional bindings which you can also specify values to use.'}], [{'type': 'paragraph', 'content': '<b>Output </b>- A property that is output from a task/condition that other inputs can bind to. You cannot bind the output to a parameter to store its return value.'}]]}]
- [{'type': 'paragraph', 'content': '<b>Property References</b> - References that allow for writing data back to the parameters similar to Blackboard keys.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'callout', 'callout_type': 'info', 'blocks': [{'type': 'paragraph', 'content': 'In 5.4, property references are only available in C++, but there is a BP version coming in 5.5. The BP struct is called <b>FStateTreeBlueprintPropertyRef</b>, and it is already present in the UE5 Main branch. The BP version can be used to read the parameters, but it does not allow for setting the parameter as is possible with <b>FStateTreePropertyRef </b>in C++.'}]}]]}]
- [{'type': 'paragraph', 'content': '<b>State </b>- Organizational layers inside of StateTree that can contain child states, tasks, entry conditions, and transitions. States can have varying types'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>State </b>- Basic state used in the tree'}], [{'type': 'paragraph', 'content': '<b>Group </b>- Cannot have any tasks but can still have child states, enter conditions, and transitions'}], [{'type': 'paragraph', 'content': '<b>Linked </b>- Links to a Subtree state within the <b>SAME </b>StateTree asset, but execution will keep the current branch of states in the hierarchy'}], [{'type': 'paragraph', 'content': '<b>Linked Asset</b> - Allows for running another StateTree asset inside of the tree'}], [{'type': 'paragraph', 'content': '<b>Subtree </b>- A state that can be linked to from a Linked state and may have tasks, child states, conditions, and transitions still'}]]}]
- [{'type': 'paragraph', 'content': '<b>Transition </b>- Rules for where and when a state should change to another state in the tree'}]
- [{'type': 'paragraph', 'content': '<b>Utility Selection</b>\xa0- <b><i><mark class="cdx-marker">** New in 5.5 **</mark>\xa0\xa0</i></b>Scoring for states that can be used in conjunction with state selection behavior to choose the highest score or a weighted random of children with the utility scoring supplying the weighted chance.'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Utility considerations can be set up as well as using float curves to adjust the total score of a state based on one or more inputs. Multiple considerations can be chained together as well to have a more complex utility system.'}]]}]


### 


#### 

- [{'type': 'paragraph', 'content': 'Tree starts at the root node on startup'}]
- [{'type': 'paragraph', 'content': 'Child nodes are evaluated in order from top to bottom'}]
- [{'type': 'paragraph', 'content': 'If a child state has an Enter Condition, the enter condition is checked'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'Important note: if the enter condition relies on the output of a task higher in the tree’s hierarchy, there are times where it can fail because the input parameter does not have a proper value. StateTree will not run prerequisite tasks for the enter condition to be able to evaluate it. This could change in the future, but it is not currently planned.'}]]}]
- [{'type': 'paragraph', 'content': 'If the enter conditions are passed successfully, the state will be chosen if it is a leaf, and if it is a intermediate state, the tree begins evaluating this state’s child states'}]
- [{'type': 'paragraph', 'content': 'If the enter condition fails or none of the deeper children states succeed to enter, the next child state is tested'}]
- [{'type': 'paragraph', 'content': 'If all children for the tree fail to be entered, the tree will stop and enter a status of Tree Failed.'}]
- [{'type': 'paragraph', 'content': 'When changing states, the tasks and states are exited in order from leaf to root of the previous state, and the enter state events happen from root to leaf.'}, {'type': 'enhanced_list', 'style': 'ordered', 'items': [[{'type': 'paragraph', 'content': 'The tree will only exit states up to the first shared state between the previously running state and the state into which it is transitioning.'}]]}]

- [{'type': 'paragraph', 'content': 'Try Enter'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'The state will be entered as long as its enter conditions are satisfied'}], [{'type': 'paragraph', 'content': 'Try Select Children in Order'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Try Select Children at Random'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Try Select Children with Highest Utility'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Try Select Children At Random Weighted By Utility'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Try Follow Transitions'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': '<b>None</b>'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'This prevents the state from being selected directly'}]]}], [{'type': 'paragraph', 'content': 'Instead of entering the state, it will attempt to follow the transitions set up on the state'}]]}], [{'type': 'paragraph', 'content': 'Randomly choose child to enter with the probability of selecting a state based on its normalized utility consideration score'}]]}], [{'type': 'paragraph', 'content': 'Enter the state with the highest utility consideration score'}]]}], [{'type': 'paragraph', 'content': 'Reshuffles the order of child states and tries to select the first one'}]]}], [{'type': 'paragraph', 'content': 'This is the default behavior of attempting to enter the child states in order from top to bottom'}]]}], [{'type': 'paragraph', 'content': 'This allows for an intermediate state to be entered even if it has leaf states'}]]}]


#### 


## 


### 


### 

- [{'type': 'paragraph', 'content': 'Wander around the level'}]
- [{'type': 'paragraph', 'content': 'Flee from danger'}]
- [{'type': 'paragraph', 'content': 'Watch threats after fleeing'}]
- [{'type': 'paragraph', 'content': 'Graze/eat'}]
- [{'type': 'paragraph', 'content': 'Idle'}]
- [{'type': 'paragraph', 'content': 'Assess situation when in danger'}]

- [{'type': 'paragraph', 'content': 'Danger'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Flee'}], [{'type': 'paragraph', 'content': 'Assess Situation'}], [{'type': 'paragraph', 'content': 'Watch Threat'}]]}]
- [{'type': 'paragraph', 'content': 'Peaceful'}, {'type': 'enhanced_list', 'style': 'unordered', 'items': [[{'type': 'paragraph', 'content': 'Wander'}], [{'type': 'paragraph', 'content': 'Graze'}], [{'type': 'paragraph', 'content': 'Idle'}]]}]


### 


## 


### 


### 


### 


#### 


#### 


## 


### 


### 


### 


## 


### 


### 


### 


## 


### 


### 


```

```


#### 


```

```

- [{'type': 'paragraph', 'content': '<b>SetGenericTeamId</b>'}]
- [{'type': 'paragraph', 'content': '<b>GetGenericTeamId</b>'}]


```

```


```

```


```

```


#### 


```

```


```

```


### 


### 


### 


#### 


#### 


#### 


#### 


#### 


##