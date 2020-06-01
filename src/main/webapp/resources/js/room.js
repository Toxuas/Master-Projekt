'use strict';
/////////////////////////////////////////////////////////
//  Creating and assigning local media stream from webcam
////////////////////////////////////////////////////////
let localStream;
const localVideo = document.getElementById("localVideo");
const videoConstraints = {video: true, audio: true};
//https://developer.mozilla.org/en-US/docs/Web/API/URL
let loc = window.location;
console.log(loc);
//https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
let params = new URLSearchParams(loc.search);
let socket_url;
if (loc.protocol === "https:") {
    socket_url = "wss:";
} else if (loc.hostname === "localhost") { //should be removed in production
    socket_url = "ws:";
} else {
    alert("Diese Anwendung muss über HTTPS aufgerufen werden.");
}
socket_url += "//" + loc.host + "/video-conference/signaling" + "/" + params.get("action") + "/" + params.get("roomId") + "/" + params.get("userName");
//ToDo: Seite für "Einladung" erstellen. Der Raumname ist bereits im Parameter gesetzt nur Username wird dann eingegeben.
//ToDo: Quasi die Zwischenseite zwischem dem Anmelden und der Lobby

//ToDo: Raum Id anzeigen in der Lobby
navigator.mediaDevices.getUserMedia(videoConstraints)
    .then(function (stream) {
        setLocalStream(stream);
        initSocket();
    }).catch(function (error) {
    alert(`getUserMedia error. ${error.message} \nPrüfen Sie ob eine Aufnahmegerät angeschlossen ist.`)
});

function setLocalStream(stream) {
    localStream = stream;
    localVideo.srcObject = localStream;

    const videoTracks = localStream.getVideoTracks();
    if(videoTracks.length > 0)
        console.log(`Using video device: ${videoTracks[0].label}`);
    const audioTracks = localStream.getAudioTracks();
    if(audioTracks.length > 0)
        console.log(`Using audio device: ${audioTracks[0].label}`);
}

/////////////////////////////////////////////////////////
// Initializing socket and assigning event handlers
// Whenever a message is received from the webserver (onmessage), the intention of the message is determined and the corresponding function for the WebRTC Communication is called.
// Reminder: Because javascript is executed on the client side each user (Browsers) that accesses the corresponding site that includes this script, creates a socket that
// communicates to the server. The server has a list with all clients that are connected to the socket endpoint and sends all messages it receives from a client
// to every other client (except the one that send a message to it initially). Therefore every client will be informed about a new user that connects or disconnects to/from the endpoint.
////////////////////////////////////////////////////////
function initSocket() {
    const socket = new WebSocket(socket_url);

    window.socket = socket;
    socket.onopen = function (event) {
        console.log(event);
    };
    socket.onmessage = function (event) {
        const content = JSON.parse(event.data);
        const data = content.data;
        console.log(event);
        console.log(content);
        const senderId = content.senderSessionId;
        const targetId =  content.targetSessionId;
        switch(content.event){
            case "getNewUserId":
                localSessionId = content.sessionId;
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
    };
    socket.onclose = function (event) {
        console.log(event);
        console.log(loc);
        console.log(event.reason.length);
        if (event.reason.length === 0) {
            alert(`Die Verbindung wurde getrennt: ${event.reason}`);
        } else {
            alert(event.reason);
        }
        window.location.href = loc.origin + "/video-conference";
    };
    socket.onerror = function(event){
        console.log(event);
    };
}

function sendToServer(message){
    socket.send(JSON.stringify(message));
}
/////////////////////////////////////////////////////////
// Initializing Peer Connection, assigning event handlers and defining methods
// Each client needs one peer connection for another user. So if there are two clients in the room each client only needs one RTCPeerConnection which are connected.
// If you have 5 clients in the room each client needs 4 RTC Peer Connections (one for each other user). This results in a n:m relation.
////////////////////////////////////////////////////////
let peerConnections = [];
window.peerConnections = peerConnections;
const servers = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302'}]};
let localSessionId = null;
/**This function is called whenever the websocket receives a message which holds the message "user-connected", because every client(including the new user) has to create a new
 * RTCPeerConnection then
 Liste mit bereits vorhandenen Clients und deren ID zurückgegeben werden, die dann hier iteriert wird. Die bereits vorhandenen Benutzer dürfen allerdings nur eine(!) weitere
 Connection für den 3. Client aufbauen. Es muss also unterschieden werden ob der Client neu ist oder bereits in peerConnection[] vorhanden ist.
 https://github.com/kolson25/WebRTC-Multi-Peer-Video-Audio/blob/master/client/webrtc.js*/
function initNewPeerConnection(senderSessionId, roomSize, roomParticipants){
    //even if you are the first user you have to create an rtc peer connection to send your stream data, however there wont be another rtc peer connection yet
    /**
     *
     * */
    console.log(roomParticipants);
    roomParticipants.forEach(function(roomParticipant){
        //check if the client does already have a connection && if the current roomParticipant isn't yourself (dont create a RTCPeerConnection for yourself)
        if(!peerConnections[roomParticipant.sessionId] && roomParticipant.sessionId !== localSessionId){
            console.log("init new peer connection for sessionId "+ roomParticipant.sessionId);
            peerConnections[roomParticipant.sessionId] = new RTCPeerConnection(servers);
            peerConnections[roomParticipant.sessionId].onicecandidate = function(event){
                if(event.candidate != null){
                    sendToServer({
                        event: "candidate",
                        senderSessionId: localSessionId,
                        targetSessionId: roomParticipant.sessionId,
                        data : event.candidate
                    });
                }
            };
            peerConnections[roomParticipant.sessionId].ontrack = function (event){
                gotRemoteStream(roomParticipant.sessionId, event);
            };
            for(const track of localStream.getTracks()){
                peerConnections[roomParticipant.sessionId].addTrack(track, localStream);
            }
        }
    });

    //send an offer back to the new client (the one that send the message "user-connected")
    //the new client itself should not send an offer to himself though
    if(roomSize >= 2 && localSessionId !== senderSessionId){
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

function handleAnswer(senderId, answer){
    peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(answer)).then(success => {
        console.log(`Connection established successfully!`);
    }).catch(error => {
        console.log(`Error in handleAnswer ${senderId}, exception: ${error.message}`);
    });
}
function handleCandidate(senderId, candidate){
    peerConnections[senderId].addIceCandidate(new RTCIceCandidate(candidate)).catch(error => {
        console.log(`Error in handleCandidate, exception: ${error.message}`);
    });
}
function handleOffer(senderId, offer){
    peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(offer)).catch(error => {
        console.log(`Error in handleOffer, exception: ${error.message}`);
    });
    createAnswer(senderId);
}

function createOffer(senderId){
    peerConnections[senderId].createOffer().then(function(sessionDescription){
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

    }).catch(function(error){
        alert("Error creating an offer: "+error.message);
    });
}
function createAnswer(senderId){
    // create and send an answer to an offer
    peerConnections[senderId].createAnswer().then(function(sessionDescription) {
        peerConnections[senderId].setLocalDescription(sessionDescription).catch(error => {
            console.log(`Error in createAnswer setLocalDescription, exception: ${error.message}`);
        });
        sendToServer({
            event: "answer",
            senderSessionId: localSessionId,
            targetSessionId: senderId,
            data: sessionDescription
        });
    }, function(error) {
        alert("Error creating an answer: "+error.message);
    });
}
function closePeerConnection(senderId){
    const index = peerConnections.indexOf(senderId);
    peerConnections.splice(index, 1);

    let sessionVideo = document.querySelector('video[data-socket="'+senderId+'"]');
    sessionVideo.remove();

}
/*
 * Check if there is already an existing <video> for this session. If there is one, the src object is updated with the media stream in the RTCTrackEvent.
 * Otherwise there will be a new one created and appended. The session id is added to the <video> tag trough the 'data-socket' attribute to later connect it to the sessionId.
 */
function gotRemoteStream(senderId, event){
    console.log("got remote stream from "+senderId);
    const stream = event.streams[0];
    console.log(stream);
    let sessionVideo = document.querySelector('video[data-socket="'+senderId+'"]');
    if(sessionVideo !== null){
        sessionVideo.srcObject = stream;
    }else{
        const video  = document.createElement('video');
        const vidContainer = document.getElementById('videoContainer');

        video.setAttribute('data-socket', senderId);
        video.srcObject = stream;
        video.autoplay = true;
        video.playsinline = true;
        vidContainer.appendChild(video);
    }
}