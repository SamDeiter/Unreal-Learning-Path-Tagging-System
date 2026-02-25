# Networked Physics - Pawn Tutorial

*Tutorial for creating a custom physics-driven pawn that works in multiplayer through physics resimulation.*

## 


### 

- [{'type': 'paragraph', 'content': 'Rewind - Go back in time and set objects to their recorded states for that time.'}]
- [{'type': 'paragraph', 'content': 'Correct - Apply received states from the server at the current rewind time.'}]
- [{'type': 'paragraph', 'content': 'Resimulate - Step through the physics simulation up until the current time, applying recorded inputs and performing physics thread callbacks again.'}]


## 


### 

- [{'type': 'paragraph', 'content': 'Enable <b>Physics Prediction</b>\xa0in Project Settings → Physics → Replication.'}]
- [{'type': 'paragraph', 'content': 'Enable\xa0<b>Tick Physics Async</b>\xa0in Project Settings → Physics → Framerate.'}]


### 


```

```


```

```


```

```


## 


### 


```

```


### 


### 


```

```


```

```


```

```


#### 


```

```


### 


```

```


### 


```

```


```

```


```

```


```

```


### 


```

```


## 


### 


```

```


```

```


```

```


### 


```

```


```

```


### 


```

```


### 

- [{'type': 'paragraph', 'content': 'Autonomous Proxy Client (Normal simulation and Resimulation)'}]
- [{'type': 'paragraph', 'content': 'Simulated Proxy Client (Normal simulation and Resimulation)'}]
- [{'type': 'paragraph', 'content': 'Server (Normal simulation)'}]


```

```

- [{'type': 'paragraph', 'content': '<code class="inline-code">ApplyInput_Internal()</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">OnProcessInputs_Internal()</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">BuildInput_Internal()</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">OnPreSimulate_Internal()</code>'}]


```

```


```

```


## 


```

```


```

```


## 


### 


### 


## 


### 


### 


#### 

- [{'type': 'paragraph', 'content': 'Green\xa0= Default Replication (Game Thread / Physics Thread mixed flow)'}]
- [{'type': 'paragraph', 'content': 'Light Blue\xa0= Default Replication (Physics Thread flow)'}]
- [{'type': 'paragraph', 'content': 'Yellow\xa0= Predictive Interpolation'}]
- [{'type': 'paragraph', 'content': 'Red\xa0= Resimulation'}]


#### 

- [{'type': 'paragraph', 'content': 'Yellow rectangles linked by lines - Physics state after each physics frame.'}]
- [{'type': 'paragraph', 'content': 'Green rectangles - Game rendered state interpolated between two physics states, there might be none, one or several between each yellow rectangle.'}]
- [{'type': 'paragraph', 'content': "Red rectangle - This is the state of the particle after a resimulation was done (note that you don't see the resimulation steps here)."}]
- [{'type': 'paragraph', 'content': 'Red line - The "error" offset between the pre-resim and post-resim state, which needs to be covered up during render interpolation.'}]
- [{'type': 'paragraph', 'content': 'Blue line - The error offset from a resim being applied on each game render state while decaying to 0 over time.'}]


###