package de.uni.videoconference;

import javax.enterprise.event.Observes;
import javax.json.*;
import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.logging.Logger;

//ToDO: add @PathParam("room") like "/signaling/{roomId}
@ServerEndpoint(value = "/signaling", encoders = {JSONEncoder.class}, decoders = {JSONDecoder.class})
public class SignalingServer {
        private static final Logger log = Logger.getLogger(SignalingServer.class.getName());

        private static final Set<Session> peers = Collections.synchronizedSet(new HashSet<Session>());

        @OnOpen
        //ToDO: Liste mit aktuellen Clients des Raumes mitsenden
        public void onOpen(Session session) {
            peers.add(session);

            Message message = new Message(Json.createObjectBuilder()
                    .add("event", "getNewUserId").add("data", "You are now connected.")
                    .add("sessionId", session.getId()).build());
            //send message to new connected user with his session id
            try{
                session.getBasicRemote().sendObject(message);
            }catch(IOException | EncodeException ex){
                ex.printStackTrace();
            }
            //create list with all connected clients
            JsonArrayBuilder jsonArrayBuilder = Json.createArrayBuilder();
            for (Session peer: peers) {
                JsonObjectBuilder jsonObjectBuilder = Json.createObjectBuilder();
                jsonObjectBuilder.add("sessionId", peer.getId());
                jsonArrayBuilder.add(jsonObjectBuilder);
            }
            JsonArray jsonArray = jsonArrayBuilder.build();

            Message msg = new Message(Json.createObjectBuilder()
                    .add("event", "user-connected").add("data", "User has connected")
                    .add("senderSessionId", session.getId()).add("roomSize", peers.size()).add("roomParticipants", jsonArray).build());
            //send message to everyone (including the new user) that a new user connected, and each client should therefore create a new RTCPeerConnection
            for (Session s : peers) {
                try {
                    s.getBasicRemote().sendObject(msg);
                } catch (IOException | EncodeException ex) {
                    ex.printStackTrace();
                }
            }
            log.info(session.getId() + " has connected");
            log.info(peers.size() + " sessions");
        }

        @OnMessage
        public void onMessage(Message message, Session session) {
            //if there is a target id, only send the message to the specific session with that id
            //otherwise if you send messages like icecandidate-data to already established RTCPeerConnections an error is thrown.
            // https://stackoverflow.com/questions/30109011/webrtc-failed-to-add-a-third-peer-cannot-set-remote-answer-in-state-stable?rq=1
            String targetSessionId = message.getJson().getString("targetSessionId");
            if(targetSessionId != null){
                for (Session s : peers) {
                    try {
                        if (s.isOpen() && s.getId().equals(targetSessionId)){
                            s.getBasicRemote().sendObject(message);
                        }
                    } catch (IOException | EncodeException ex) {
                        ex.printStackTrace();
                    }
                }
            }else{
                for (Session s : peers) {
                    try {
                        if (s.isOpen() && !session.getId().equals(s.getId())){
                            s.getBasicRemote().sendObject(message);
                        }
                    } catch (IOException | EncodeException ex) {
                        ex.printStackTrace();
                    }
                }
            }
        }


        @OnClose
        public void onClose(Session session) {
            peers.remove(session);
            Message message = new Message(Json.createObjectBuilder()
                    .add("event", "user-disconnected").add("data", "User has disconnected").add("senderSessionId", session.getId()).build());

            for (Session s : peers) {
                try {
                    s.getBasicRemote().sendObject(message);
                } catch (IOException | EncodeException ex) {
                    ex.printStackTrace();
                }
            }
            log.info("User disconnected");
        }

        @OnError
        public void onError(Session session, Throwable t) {
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
