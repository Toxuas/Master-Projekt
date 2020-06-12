'use strict';

class VideoConference extends HTMLElement {

    constructor() {
        super();
        this.socket = null;
        this.localSessionId = null;
        this.localStream = null;
        this.peerConnections = [];
    }

    connectedCallback() {
        let loc = window.location; //https://developer.mozilla.org/en-US/docs/Web/API/URL
        let socketHostname = this.getAttribute("socketHostname");
        let socketPathname = this.getAttribute("socketPathname");

        if (typeof socketHostname === "undefined" || socketHostname === null) {
            socketHostname = loc.host;
        }
        if (typeof socketPathname === "undefined" || socketPathname === null) {
            socketPathname = "/video-conference/signaling";
        }
        const videoConstraints = {video: true, audio: true};
        let params = new URLSearchParams(loc.search); //https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
        let socket_url;
        if (loc.protocol === "https:") {
            socket_url = "wss:";
        } else if (loc.hostname === "localhost") { //should be removed in production
            socket_url = "ws:";
        } else {
            alert("Diese Anwendung muss über HTTPS aufgerufen werden.");
        }
        socket_url += "//" + socketHostname + socketPathname + "/" + params.get("action") + "/" + params.get("roomId") + "/" + params.get("userName");
        //ToDo: Seite für "Einladung" erstellen. Der Raumname ist bereits im Parameter gesetzt nur Username wird dann eingegeben.
        //ToDo: Quasi die Zwischenseite zwischem dem Anmelden und der Lobby

        //ToDo: Raum Id anzeigen in der Lobby
        navigator.mediaDevices.getUserMedia(videoConstraints)
            .then(function (stream) {
                this._assignLocalStream(stream);
                this._initSocket(socket_url);
            }.bind(this)).catch(function (error) {
            alert(`getUserMedia error. ${error.message} \nPrüfen Sie ob eine Aufnahmegerät angeschlossen ist.`)
        });
    }

    _assignLocalStream(stream) {
        this.localStream = stream;

        let localVideo = new HTMLVideoElement();
        localVideo.id = "localVideo";
        localVideo.autoplay = true;
        localVideo.muted = true;
        localVideo.playsinline = true;
        localVideo.srcObject = this.localStream;
        this.appendChild(localVideo);

        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0)
            console.log(`Using video device: ${videoTracks[0].label}`);
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0)
            console.log(`Using audio device: ${audioTracks[0].label}`);

    }

    /////////////////////////////////////////////////////////
    // Initializing socket and assigning event handlers
    // Whenever a message is received from the webserver (onmessage), the intention of the message is determined and the corresponding function for the WebRTC Communication is called.
    // Reminder: Because javascript is executed on the client side each user (Browsers) that accesses the corresponding site that includes this script, creates a socket that
    // communicates to the server. The server has a list with all clients that are connected to the socket endpoint and sends all messages it receives from a client
    // to every other client (except the one that send a message to it initially). Therefore every client will be informed about a new user that connects or disconnects to/from the endpoint.
    ////////////////////////////////////////////////////////
    _initSocket(socketURL) {
        this.socket = new WebSocket(socketURL);
        this.socket.onopen = function (event) {
            console.log(event);
        };
        this.socket.onmessage = function (event) {
            const content = JSON.parse(event.data);
            const data = content.data;
            console.log(event);
            console.log(content);
            const senderId = content.senderSessionId;
            const targetId = content.targetSessionId;
            switch (content.event) {
                case "getNewUserId":
                    this.localSessionId = content.sessionId;
                    break;
                case "user-connected":  //also happens if you are the first one connecting, and no peer connection exists already. For every new user in the room every client has to create a new RTCPeerConnection
                    initNewPeerConnection(senderId, content.roomSize, content.roomParticipants);
                    break;
                case "offer":
                    handleOffer(senderId, data);
                    break;
                case "answer":
                    handleAnswer(senderId, data);
                    break;
                case "candidate":
                    handleCandidate(senderId, data);
                    break;
                case "user-disconnected":
                    closePeerConnection(senderId);
                    break;
                default:
                    break;
            }
        }.bind(this);
        this.socket.onclose = function (event) {
            console.log(event);
            console.log(event.reason.length);
            if (event.reason.length === 0) {
                alert(`Die Verbindung wurde getrennt: ${event.reason}`);
            } else {
                alert(event.reason);
            }
        };
        this.socket.onerror = function (event) {
            console.log(event);
        };
    }

    sendToServer(msg) {
        this.socket.send(JSON.stringify(msg));
    }
}