'use strict';

class VideoConference extends HTMLElement {

    constructor() {
        super();
        this.servers = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};
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
                    this.initNewPeerConnection(senderId, content.roomSize, content.roomParticipants);
                    break;
                case "offer":
                    this.handleOffer(senderId, data);
                    break;
                case "answer":
                    this.handleAnswer(senderId, data);
                    break;
                case "candidate":
                    this.handleCandidate(senderId, data);
                    break;
                case "user-disconnected":
                    this.closePeerConnection(senderId);
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

    /**This function is called whenever the websocket receives a message which holds the message "user-connected", because every client(including the new user) has to create a new
     * RTCPeerConnection then
     Liste mit bereits vorhandenen Clients und deren ID zurückgegeben werden, die dann hier iteriert wird. Die bereits vorhandenen Benutzer dürfen allerdings nur eine(!) weitere
     Connection für den 3. Client aufbauen. Es muss also unterschieden werden ob der Client neu ist oder bereits in peerConnection[] vorhanden ist.
     https://github.com/kolson25/WebRTC-Multi-Peer-Video-Audio/blob/master/client/webrtc.js*/
    initNewPeerConnection(senderSessionId, roomSize, roomParticipants) {
        //even if you are the first user you have to create an rtc peer connection to send your stream data, however there wont be another rtc peer connection yet
        /**
         *
         * */
        console.log(roomParticipants);
        roomParticipants.forEach(function (roomParticipant) {
            //check if the client does already have a connection && if the current roomParticipant isn't yourself (dont create a RTCPeerConnection for yourself)
            if (!peerConnections[roomParticipant.sessionId] && roomParticipant.sessionId !== localSessionId) {
                console.log("init new peer connection for sessionId " + roomParticipant.sessionId);
                peerConnections[roomParticipant.sessionId] = new RTCPeerConnection(this.servers);
                peerConnections[roomParticipant.sessionId].onicecandidate = function (event) {
                    if (event.candidate != null) {
                        sendToServer({
                            event: "candidate",
                            senderSessionId: this.localSessionId,
                            targetSessionId: roomParticipant.sessionId,
                            data: event.candidate
                        });
                    }
                }.bind(this);
                peerConnections[roomParticipant.sessionId].ontrack = function (event) {
                    gotRemoteStream(roomParticipant.sessionId, event);
                };
                for (const track of localStream.getTracks()) {
                    peerConnections[roomParticipant.sessionId].addTrack(track, localStream);
                }
            }
        }.bind(this));

        //send an offer back to the new client (the one that send the message "user-connected")
        //the new client itself should not send an offer to himself though
        if (roomSize >= 2 && localSessionId !== senderSessionId) {
            createOffer(senderSessionId);
        }
    }

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

    handleAnswer(senderId, answer) {
        peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(answer)).then(success => {
            console.log(`Connection established successfully!`);
        }).catch(error => {
            console.log(`Error in handleAnswer ${senderId}, exception: ${error.message}`);
        });
    }

    handleCandidate(senderId, candidate) {
        peerConnections[senderId].addIceCandidate(new RTCIceCandidate(candidate)).catch(error => {
            console.log(`Error in handleCandidate, exception: ${error.message}`);
        });
    }

    handleOffer(senderId, offer) {
        peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(offer)).catch(error => {
            console.log(`Error in handleOffer, exception: ${error.message}`);
        });
        createAnswer(senderId);
    }

    createOffer(senderId) {
        peerConnections[senderId].createOffer().then(function (sessionDescription) {
            peerConnections[senderId].setLocalDescription(sessionDescription).then(() => {
                sendToServer({
                    event: "offer",
                    senderSessionId: localSessionId,
                    targetSessionId: senderId,
                    data: sessionDescription
                });
            }).catch(error => {
                console.log(`Error in createOffer setLocal Description, exception: ${error.message}`);
            });

        }).catch(function (error) {
            alert("Error creating an offer: " + error.message);
        });
    }

    createAnswer(senderId) {
        // create and send an answer to an offer
        peerConnections[senderId].createAnswer().then(function (sessionDescription) {
            peerConnections[senderId].setLocalDescription(sessionDescription).catch(error => {
                console.log(`Error in createAnswer setLocalDescription, exception: ${error.message}`);
            });
            sendToServer({
                event: "answer",
                senderSessionId: localSessionId,
                targetSessionId: senderId,
                data: sessionDescription
            });
        }, function (error) {
            alert("Error creating an answer: " + error.message);
        });
    }

    closePeerConnection(senderId) {
        const index = peerConnections.indexOf(senderId);
        peerConnections.splice(index, 1);

        let sessionVideo = document.querySelector('video[data-socket="' + senderId + '"]');
        sessionVideo.remove();

    }

    /*
     * Check if there is already an existing <video> for this session. If there is one, the src object is updated with the media stream in the RTCTrackEvent.
     * Otherwise there will be a new one created and appended. The session id is added to the <video> tag trough the 'data-socket' attribute to later connect it to the sessionId.
     */
    gotRemoteStream(senderId, event) {
        console.log("got remote stream from " + senderId);
        const stream = event.streams[0];
        console.log(stream);
        let sessionVideo = document.querySelector('video[data-socket="' + senderId + '"]');
        if (sessionVideo !== null) {
            sessionVideo.srcObject = stream;
        } else {
            const video = document.createElement('video');

            video.setAttribute('data-socket', senderId);
            video.srcObject = stream;
            video.autoplay = true;
            video.playsinline = true;
            this.appendChild(video);
        }
    }
}

customElements.define("video-conference", VideoConference);