package de.uni.videoconference;

import javax.websocket.Session;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class Room {
    private int maxUsers = 20;
    private String roomId;
    private Set<Session> sessions = Collections.synchronizedSet(new HashSet<>());
    public Room(String roomId) {
        this.roomId = roomId;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public Set<Session> getSessions() {
        return sessions;
    }

    public int getMaxUsers() {
        return maxUsers;
    }

    public void setMaxUsers(int maxUsers) {
        this.maxUsers = maxUsers;
    }

    @Override
    public String toString() {
        return "Room{" +
                "maxUsers=" + maxUsers +
                ", roomId='" + roomId + '\'' +
                ", sessions=" + sessions +
                '}';
    }
}
