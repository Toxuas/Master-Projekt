package de.uni.videoconference.jsfBeans;

import javax.faces.view.ViewScoped;
import javax.inject.Named;
import java.io.Serializable;

@ViewScoped
@Named
public class indexBean implements Serializable {
    private String userName;
    private String roomId;
    private String action;

    public String enterRoom() {
        action = "join";
        return "room?faces-redirect=true&includeViewParams=true";
    }

    public String createRoom() {
        action = "create";
        return "room?faces-redirect=true&includeViewParams=true";
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomName) {
        this.roomId = roomName;
    }
}
