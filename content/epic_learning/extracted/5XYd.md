# Mythen aufdecken – "Best Practices" in der Unreal Engine

*Sind Ticks wirklich so problematisch? Solltest du alle deine Meshs auf Nanite umstellen? Ist die ChildActorComponent wirklich verflucht? Sollte man Cast wirklich nie verwenden? Wahrscheinlich hast du schon von vielen dieser sogenannten "Best Practices" gehört. Stellen wir sie doch mal auf die Probe und finden heraus, welche wahr sind und welche nicht.*

## 


## 


### 

- [{'type': 'paragraph', 'content': 'Tick Groups: Damit kannst du einstellen, wann das Objekt im Frame getickt wird, zum Beispiel vor oder nach der Berechnung der Physik. Ich möchte speziell auf die Tick-Gruppe "DuringPhysics" hinweisen, die du verwenden kannst, wenn du keine Transformierungen lesen oder einrichten musst\xa0– dann kannst du diesen Tick ausführen, während UE seine Physik berechnet.'}]
- [{'type': 'paragraph', 'content': 'Tick Dependencies: Ermöglichen es dir, einzustellen, dass ein Actor erst dann tickt, wenn bestimmte andere Actors zuvor getickt haben.'}]
- [{'type': 'paragraph', 'content': 'Tick Interval: Du kannst es jederzeit für jeden Actor ändern. Actors werden zuerst getickt.'}]
- [{'type': 'paragraph', 'content': 'Disabling / Enabling of Tick: Du kannst die Tick-Funktion eines Actors jederzeit deaktivieren oder aktivieren.'}]


### 

- [{'type': 'paragraph', 'content': 'Blueprint-Ticks im Editor (dunkelblau)'}]
- [{'type': 'paragraph', 'content': 'Blueprint-Ticks in einem verpackten Entwicklungs-Build (hellblau)'}]
- [{'type': 'paragraph', 'content': 'C++-Ticks im Editor (dunkelgrün)'}]
- [{'type': 'paragraph', 'content': 'C++-Ticks in einem verpackten Entwicklungs-Build (hellgrün)'}]


### 


### 


### 


### 

- [{'type': 'paragraph', 'content': 'Arbeite nicht zu viel in Ticks.'}]
- [{'type': 'paragraph', 'content': 'Lass keine unangemessene Anzahl von Ticks laufen.'}]
- [{'type': 'paragraph', 'content': 'Du wirst durch das <b>PROFILING</b> merken, wenn du zu viel arbeitest oder wenn die Anzahl der Ticks unangemessen hoch ist!'}]


## 


### 

- [{'type': 'paragraph', 'content': 'Man muss dabei ein paar Einschränkungen umschiffen.'}]


## 


### 


### 


### 


### 

- [{'type': 'paragraph', 'content': 'Wenn dir der BP-Overhead für einen Code Probleme verursacht, verschiebe diesen Code nach C++. Es gibt keine Trophäe für die Auslieferung eines Spiels nur in BP. Es GIBT jedoch einen Preis für das beste Spiel. Am Ende schreibst du vielleicht nur zwei C++-Funktionen, damit dein Spiel läuft, und das ist völlig in Ordnung.'}]
- [{'type': 'paragraph', 'content': 'Damit kommst du aber nicht weit. Oft machst du einfach zu viel, BP hin oder her. Du kannst eine Funktion nur einmal zu C++ konvertieren. Ist sie dann immer noch langsam, musst du eine andere Möglichkeit finden, sie zu optimieren. Und diese Optimierung wäre unabhängig davon gültig gewesen, ob du BP oder C++ verwendest.'}]
- [{'type': 'paragraph', 'content': 'Woher weißt du, welche Funktionen so viel BP-Overhead haben, dass sie zu C++ verschoben werden sollten? Durch PROFILING!'}]


### 

- [{'type': 'paragraph', 'content': 'Das bedeutet nicht, dass du sie nicht verwenden solltest.'}]
- [{'type': 'paragraph', 'content': 'Denn die sind außerdem super vielseitig und schnell zu iterieren.'}]
- [{'type': 'paragraph', 'content': 'Sie gestatten es Nicht-Programmierern im Team, Code beizutragen.'}]


## 


### 


### 


### 


### 


## 


### 

- [{'type': 'paragraph', 'content': 'Was nicht bedeutet, dass du Nanite nicht verwenden solltest.'}]
- [{'type': 'paragraph', 'content': 'Es ermöglicht durch seinen neuen Ansatz zur Vereinfachung und Rasterung komplexere Geometrien als bisher.'}]
- [{'type': 'paragraph', 'content': 'Durch den Binned-Shading-Ansatz kann es beim Rendern von Szenen effizienter sein.'}]
- [{'type': 'paragraph', 'content': 'Vergiss auf jeden Fall nicht, während der Arbeit das Profiling, die Bewertung und die Optimierung fortlaufend vorzunehmen.'}]
- [{'type': 'paragraph', 'content': 'Nanite verfügt über ein großartiges Zusammenspiel mit Lumen und virtuellen Shadow-Maps.'}]


## 


### 


### 


## 


### 


### 


## 


### 


### 


### 


## 


### 


### 


### 


### 


##