**HTTP-basiertes Streaming (mehrere mögl. Protokolle von verschiedenen Anbietern)**
   * Datei wird an den Server übertragen
   * Datei wird in eine Vielzahl an Segmenten partitioniert mit unterschiedlichen
Auflösungen, Bitraten etc. 
   * Diese Segmente werden stückweise an den Client gesendet
   * Da zuerst mehrere Segmente übertragen werden müssen (Buffering), bevor das Medium dargestellt werden
   kann (um eine flüssige Wiedergabe zu ermöglichen) entsteht eine merkliche Verzögerung, da
diese Segmente natürlich zuerst heruntergeladen werden müssen.-> ungeeignet für Echtzeitübertragungen
   * Diese Verzögerung
kann sich je nach Systemarchitektur und Komplexität (bspw. Zwischenkomponenten) ändern
   * Ermöglicht adaptives Streaming über HTTP, da je nach vorhandener Bandbreite Segmente/Datenpakete
heruntergeladen werden, die in einer passenden Bitrate encodiert sind und "rechtzeitig" heruntergeladen werden können,
um eine flüssige Wiedergabe zu ermöglichen -> Eignet sich sehr gut für Videostreaming, da Latenz
eher nebensächlich, Videoqualität und flüssige Wiedergabe wichtiger (Übertragung per TCP, alle Pakete werden übermittelt) 
   * Ermöglicht serverseitige Kontrolle der Wiedergabequalität

**WebRTC**
   * Daten werden direkt zwischen den Clients übertragen (P2P, Peer-to-Peer)
   * Wesentlich geringere Latenzzeiten als HLS oder MPEG-DASH-Lösungen, allerdings etwas schlechtere Streaming Qualität (Datenübertragung per UDP, Packetverlust möglich)
   -> Echtzeitübertragung möglich (Latenz im niedrigen ms Bereich, eignet sich gut für Webkonferenzen)
   * Sehr geringe Serverbeteiligung & Last ( dient nur zur Etablierung der Kommunikation bzw. RTCPeerConnection)
   * Daten werden ausschließlich clientseitig verarbeitet (durch die WebRTCEngine des Webbrowsers), wodurch es zu einem hohen Speicherverbrauch
   kommen kann
   * Erfordert N:M Beziehung der Clients, daher nicht unendlich skalierbar
   * Wiedergabequalität kann nicht serverseitig kontrolliert werden