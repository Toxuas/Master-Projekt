Genereller Programmablauf:

Neuer Client -> Websocket Verbindung zu Signaling Server (@OnOpen Methode serverseitig) -> alle bisherigen Clients
werden darüber informiert über eine Message mit dem Identifier 'user-connected' und der SessionId
 des neuen Clients, sowie alle SessionIds der bisher verbundenen Clients->
 Jeder Client iteriert über die Liste der verbundenen Clients, die in der Message mitgesendet wird, und legt für jeden neuen Client (
 jeder Client verwaltet ein lokales Array mit aktiven Verbindungen) eine neue RTCPeerConnection an:
 Bereits vorhandene Clients legen also jeweils eine neue RTCPeerConnection für den neuen Client an und der neue Client
 legt für jeden bereits vorhandenen Client jeweils eine RTCPeerConnection an.
 
 Nun wird bei jedem Client geprüft ob die Anzahl verbundener Clients >= 2 ist, wenn dies so ist wird von jedem Client
 eine Nachricht mit einem Offer an den neuen Client (Den Absender der Nachricht) geschickt. Hierbei schickt der
 neue Client selber auch ein Offer (also an sich selber). Zudem setzt jeder Client für die RTCPeerConnection des neuen Clients (lokal verwaltet) die LokalDescription.
 
  Das Offer wird zusammen mit der ZielId und der AbsenderId an den Signaling
 Server geschickt (@OnMessage Methode serverseitig), dieser sendet die eingehenden Nachrichten nun anhand der TargetId nur an den neuen Client (
 die Nachricht die der neue Client an sich selber schickt, wird durch Gleichheit der ZielId und AbsenderId ignoriert).
 
 Der  neue Client/Zielclient nimmt die Nachrichten entgegegen und setzt die RemoteDescription der lokalen RTCPeerConnection des Clients, der die Nachricht
 an ihn geschickt hat (Erinnerung: Jeder Client hat ein lokales Array mit RTCPeerConnections für jeweils jeden anderen Client, welche mit
 der SessionId identifiziert werden können. Durch das Mitsenden der SessionId des Absenders  und des Ziels, können die jeweiligen 
 Objekte beim Absender und Ziel jeweils adressiert werden).
 Nun erstellt der neue Client eine Answer und schickt diese, wieder mit AbsenderId und ZielId zurück an den SignalingServer
 der die Nachricht an den Zielclient (also den, der ursprünglich das Offer versendet hat) zurückschickt. Dabei setzt der neue Client zudem
 die LokalDescription der jeweiligen RTCPeerConnection.

Der Absender des Offers erhält nun die Answer und setzt die lokale RemoteDescription des
passenden RTCPeerConnection-Objektes. Vor Erhalt der Anwer werden noch die sog. IceCandidates ausgetauscht. Dann ist die Verbindung erfolgreich erstellt.

/**
 * General Logic flow:
 * Step 1: caller (new user in the room) creates offer (createOffer())

 Step 2: caller sets localDescription

 Step 3: caller sends the description to the callee

 //------------------------------------------------------//

 Step 4: callee receives the offer sets remote description (handleOffer)

 Step 5: callee creates answer (createAnswer)

 Step 6: callee sets local description

 Step 7: callee send the description to caller

 //------------------------------------------------------//

 Step 8: caller receives the answer and sets remote description (handleAnswer)
 In between the ICECandidates are interchanged
 */