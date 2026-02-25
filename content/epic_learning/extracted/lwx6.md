# Unreal Insights - Automated Trace Analysis and CSV export

*Documentation on the command-line exporters supported in Unreal Insights.
This provides all parameters and output examples for the built-in exporters that export various information from a .utrace file to CSV files.*

- [{'type': 'paragraph', 'content': 'Exporting from the Insight UI'}]
- [{'type': 'paragraph', 'content': 'CSV export from the command line'}]


## 


### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">-OpenTraceFile</code>: This specifies the input trace file to analyze'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-ABSLOG</code>: optional, used to specify the absolute path where the log file should be written to'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-NoUI</code>: Don’t create the graphical user interface.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-AutoQuit</code>: Exit the program after all <code class="inline-code">ExecOnAnalysisCompleteCmd</code> commands have been executed.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-ExecOnAnalysisCompleteCmd</code>: <br>'}, {'type': 'paragraph', 'content': 'This allows to specify a list of commands and parameters to execute once the analysis of the trace file is complete. This supports both a string with the commands itself or the name of a file to load that contains the commands to execute. The syntax for loading a file is <code class="inline-code">@=C:\\Absolute\\Path\\To\\File.rsp</code>'}]


### 


```

```


```

```


```

```


### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">-threads</code>: Filter threads by string name, supports <code class="inline-code">*</code> and <code class="inline-code">?</code> wildcards'}, {'type': 'paragraph', 'content': '<b>Default:</b> <code class="inline-code">-threads="*"</code> (all threads; no filter)'}, {'type': 'paragraph', 'content': '\t\t\t\t\t<b>Example:</b> <code class="inline-code">-threads="GameThread"</code> <code class="inline-code">-threads="GPU1,GPU2,GameThread,Render*"</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-columns</code>: comma separated list of columns to export'}, {'type': 'paragraph', 'content': 'Comma-delimited list of column names, supports <code class="inline-code">*</code> and <code class="inline-code">?</code> wildcards'}, {'type': 'paragraph', 'content': '<b>Default:</b> <code class="inline-code">-columns="ThreadId,TimerId,StartTime,EndTime,Depth"</code>'}, {'type': 'paragraph', 'content': '\t\t\t\t\t<b>Example:</b> <code class="inline-code">-columns="*"</code> <code class="inline-code">-columns="TimerName,Duration"</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-timers</code>: Filter timers by string name, supports <code class="inline-code">*</code> and <code class="inline-code">?</code> wildcards'}, {'type': 'paragraph', 'content': '\t\t\t\t\t<b>Default:</b> <code class="inline-code">-timers="*"</code> (all timers; no filter)'}, {'type': 'paragraph', 'content': '\t\t\t\t\t<b>Example:</b> <code class="inline-code">-timers="A,B,*z"</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-startTime</code>/<code class="inline-code">-endTime</code>: limit the time-frame that should be exported, in seconds (float).'}, {'type': 'paragraph', 'content': 'Only the timing events that intersect the specified interval will be used for stats aggregation.'}, {'type': 'paragraph', 'content': 'Both options are ignored if a non-empty region is specified (<code class="inline-code">-region=...</code>).'}, {'type': 'paragraph', 'content': 'Default value (if not specified) is <code class="inline-code">-infinite</code> and <code class="inline-code">+infinite</code>.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-region</code>: Comma-delimited list of region names, the command will export matching timing regions. <br>'}, {'type': 'paragraph', 'content': '\nFilters by name, supports <code class="inline-code">*</code> and <code class="inline-code">?</code> wildcard. Each region is exported to a separate file. The <code class="inline-code">*</code> char in the export Filename (if present) will be replaced with the resolved name of the region.\n\n'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">file</code>: a relative or absolute file path to a CSV (comma-separated values) or TXT/TSV (tab-separated values) file.'}]


### 


#### 


#### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">-columns</code>: comma separated list of columns to export'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-threads</code>: Filter threads by string name, supports * and ? wildcards'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-timers</code>: Filter timers by string name, supports * and ? wildcards'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-startTime</code>/<code class="inline-code">-endTime</code>: limit the timeframe that should be exported, in seconds (float)'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-region="..."</code>'}]


### 


#### 


#### 


### 


#### 


#### 


## 


#### 


#### 


## 


#### 


#### 

- [{'type': 'paragraph', 'content': '<code class="inline-code">file</code>:\xa0 A relative or absolute file path to a CSV (comma-separated values) or TXT/TSV (tab-separated values) file.'}, {'type': 'paragraph', 'content': 'The <code class="inline-code">{counter}</code> placeholder in filename (if present) will be replaced with the name of the counter.'}, {'type': 'paragraph', 'content': 'If a region is specified, the <code class="inline-code">{region}</code> placeholder in the filename (if present) will be replaced with the resolved name of the region.'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-counter=...</code>: Comma-delimited list of counter names; supports <code class="inline-code">*?</code>-type wildcard'}, {'type': 'paragraph', 'content': 'Each counter will be exported into a separate file, replacing the <code class="inline-code">{counter}</code> placeholder in the filename.'}, {'type': 'paragraph', 'content': '<b>Example:</b> <code class="inline-code">-counter="PC / *"</code>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-startTime</code> / <code class="inline-code">-endTime</code>: See explanation for the other commands above<br>'}]
- [{'type': 'paragraph', 'content': '<code class="inline-code">-region</code>: See explanation for the other commands above'}]