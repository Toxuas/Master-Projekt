package de.uni.videoconference;

import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObjectBuilder;
import javax.websocket.*;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.logging.Logger;

@ServerEndpoint(value = "/signaling/{action}/{roomId}/{userName}", encoders = {JSONEncoder.class}, decoders = {JSONDecoder.class})
public class SignalingServer {
    private static final Logger log = Logger.getLogger(SignalingServer.class.getName());
    private static final Set<Room> rooms = Collections.synchronizedSet(new HashSet<>());

    @OnOpen
    public void onOpen(@PathParam("action") String action, @PathParam("roomId") String roomId, @PathParam("userName") String userName,
                       Session session) throws Exception {
        checkNewConnection(roomId, userName, action);

        Room requestedRoom = rooms.stream()
                .filter(room -> room.getRoomId().equals(roomId)).findAny().orElse(null);
        //is valid, otherwise the checkNewConnection Function would already have thrown an exception ( if the room does not exist yet/is null and the user wanted to join instead of creating it)
        if (requestedRoom == null) {
            requestedRoom = new Room(roomId);
            rooms.add(requestedRoom);
        }

        requestedRoom.getSessions().add(session);

        Message message = new Message(Json.createObjectBuilder()
                .add("event", "getNewUserId").add("data", "You are now connected.")
                .add("roomId", requestedRoom.getRoomId()).add("sessionId", session.getId()).build());

        //send message to new connected user with his session id
        try {
            session.getBasicRemote().sendObject(message);
        } catch (IOException | EncodeException ex) {
            ex.printStackTrace();
        }
        //create list with all connected clients
        JsonArrayBuilder jsonArrayBuilder = Json.createArrayBuilder();
        for (Session peer : requestedRoom.getSessions()) {
            JsonObjectBuilder jsonObjectBuilder = Json.createObjectBuilder();
            jsonObjectBuilder.add("sessionId", peer.getId());
            jsonArrayBuilder.add(jsonObjectBuilder);
        }
        JsonArray jsonArray = jsonArrayBuilder.build();

        Message msg = new Message(Json.createObjectBuilder()
                .add("event", "user-connected").add("data", "User has connected")
                .add("senderSessionId", session.getId()).add("roomId", requestedRoom.getRoomId()).
                        add("roomSize", requestedRoom.getSessions().size()).add("roomParticipants", jsonArray).build());
        //send message to everyone (including the new user) that a new user connected to this room, and each client should therefore create a new RTCPeerConnection
        //and the new client can create a new RTCPeerConnection for each existing client
        for (Session s : requestedRoom.getSessions()) {
            try {
                s.getBasicRemote().sendObject(msg);
            } catch (IOException | EncodeException ex) {
                ex.printStackTrace();
            }
        }
        log.info(session.getId() + " has connected");
        log.info(requestedRoom.getSessions().size() + " sessions in room " + requestedRoom.getRoomId());
    }

    @OnMessage
    public void onMessage(@PathParam("roomId") String roomId, Message message, Session session) {
        //if there is a target id, only send the message to the specific session with that id
        //otherwise if you send messages like icecandidate-data to already established RTCPeerConnections an error is thrown.
        // https://stackoverflow.com/questions/30109011/webrtc-failed-to-add-a-third-peer-cannot-set-remote-answer-in-state-stable?rq=1
        Room requestedRoom = rooms.stream()
                .filter(room -> room.getRoomId().equals(roomId)).findAny().orElseThrow(() ->
                        new IllegalArgumentException("Room " + roomId + " not found"));

        String targetSessionId = message.getJson().getString("targetSessionId");
        for (Session s : requestedRoom.getSessions()) {
            try {
                if (s.isOpen()) {
                    //When there is a target id only send the message to the session that has the id
                    if (targetSessionId != null) {
                        if (s.getId().equals(targetSessionId)) {
                            s.getBasicRemote().sendObject(message);
                            break;
                        }
                    } else {
                        //dont send the message to yourself
                        if (!s.getId().equals(session.getId())) {
                            s.getBasicRemote().sendObject(message);
                        }
                    }
                }
            } catch (IOException | EncodeException ex) {
                ex.printStackTrace();
            }
        }

    }

    @OnClose
    public void onClose(@PathParam("roomId") String roomId, Session session) {
        Room requestedRoom = rooms.stream()
                .filter(room -> room.getRoomId().equals(roomId)).findAny().orElseThrow(() ->
                        new IllegalArgumentException("Room " + roomId + " not found"));

        requestedRoom.getSessions().remove(session);

        //remove room when the last user disconnected
        if (requestedRoom.getSessions().size() == 0) {
            rooms.remove(requestedRoom);
        }
        Message message = new Message(Json.createObjectBuilder()
                .add("event", "user-disconnected").add("data", "User has disconnected")
                .add("roomId", requestedRoom.getRoomId()).add("senderSessionId", session.getId()).build());

        for (Session s : requestedRoom.getSessions()) {
            try {
                s.getBasicRemote().sendObject(message);
            } catch (IOException | EncodeException ex) {
                ex.printStackTrace();
            }
        }
        log.info("User disconnected");
    }

    private void checkNewConnection(String roomId, String userName, String action) throws Exception {
        //alle parameter da und nicht leer/null
        log.info(roomId);
        log.info(userName);
        log.info(action);
        if (roomId == null || roomId.isEmpty() || userName == null || userName.isEmpty() || action == null || action.isEmpty()) {
            throw new IllegalArgumentException("Es ist keine Raum-Id, Benutzername, oder Aktion(create, join) angegeben!");
        }
        //ToDo: Refactor the whole validation of the parameters and constraint checking
        Room requestedRoom = rooms.stream()
                .filter(room -> room.getRoomId().equals(roomId))
                .findAny().orElse(null);

        if (action.equals("join")) {
            //gibt es den Raum dem beigetreten werden soll
            if (requestedRoom == null) {
                throw new Exception("Den Raum gibt es nicht! Sie müssen ihn erst erstellen.");
            }
            //kann dem Raum noch beigetreten werden
            if (requestedRoom.getSessions().size() + 1 > requestedRoom.getMaxUsers()) {
                throw new Exception("Die maximale Benutzerzahl ist bereits erreicht!");
            }
            boolean userExists = requestedRoom.getSessions().stream()
                    .anyMatch(session -> session.getPathParameters().get("userName").equals(userName));
            //ist der Benutzername noch frei
            if (userExists) {
                throw new Exception("Der Benutzername ist bereits vergeben");
            }
        } else if (action.equals("create")) {
            //gibt es den zu erstellenden Raum bereits
            if (requestedRoom != null) {
                throw new Exception("Den Raum gibt es bereits! Erstellen Sie einen neuen oder treten Sie dem offenen Raum bei.");
            }
        } else {
            throw new IllegalArgumentException("Es ist keine Raum-Id, Benutzername, oder Aktion(create, join) angegeben!");
        }
    }

    @OnError
    public void onError(Session session, Throwable t) {
        if (t instanceof Exception) {
            try {
                session.close(new CloseReason(CloseReason.CloseCodes.CANNOT_ACCEPT, t.getMessage()));
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
        log.info(t.getMessage());
    }
/**
 public void onChunk(@Observes @Chunk ByteBuffer buffer) {
 for (Session session : sessions) {
 try {
 session.getBasicRemote().sendBinary(buffer);
 } catch (IOException ex) {
 ex.printStackTrace();
 }
 }
 }
 */
}
