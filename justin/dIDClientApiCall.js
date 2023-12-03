var DID_API = {
  key: "c2FuamF5LmNoYWRoYUBzYWZldHlsYWJzLm9yZw:TeMen4hZwvoUa2F6hPL1R",
  url: "https://api.d-id.com",
  AVATAR_IMAGE_URL: "https://img.freepik.com/free-photo/young-bearded-man-with-striped-shirt_273609-5677.jpg?w=996&t=st=1701251990~exp=1701252590~hmac=36ec1ade040b41ca0594c29a529e18049d307cae5abf170847a8707f25f7e62f"
}

if (!DID_API.key) alert('Please put your api key and restart..');

const connectButton = document.getElementById('connect-button');
connectButton.addEventListener("click", createPeerConnectionFunction);
const talkButton = document.getElementById('talk-button');

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);
var peerConnection;
var streamId;
var sessionId;
var sessionClientAnswer;

var statsIntervalId;
var videoIsPlaying;
var lastBytesReceived;

const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');
const streamingStatusLabel = document.getElementById('streaming-status-label');

function addLoader() {
  document.getElementById("spinner").style.display = "block";
}
function removeLoader() {
  document.getElementById("spinner").style.display = "none";
}


async function createPeerConnectionFunction() {
  if (peerConnection && peerConnection.connectionState === 'connected')
    return;
  addLoader()
  stopAllStreams();
  closePC();
  await fetchWithRetries(`${DID_API.url}/talks/streams`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      Authorization: `Basic ${DID_API.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_url: `${DID_API.AVATAR_IMAGE_URL}`,
    }),
  })
    .then(res => res.json())
    .then(async sessionResponseJson => {
      console.log("Create stream connection - response: ", sessionResponseJson);
      streamId = sessionResponseJson.id;
      sessionId = sessionResponseJson.session_id;
      try {
        sessionClientAnswer = await createPeerConnection(sessionResponseJson.offer, sessionResponseJson.ice_servers);
      } catch (e) {
        console.log('error during streaming setup', e);
        stopAllStreams();
        closePC();
        return;
      }
    })
    .catch((error) => {
      console.error(error.message);
    })

  await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${DID_API.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      answer: sessionClientAnswer,
      session_id: sessionId,
    }),
  })
    .then((response) => {
      console.log("Start Session", response);
      return response.json();
    })
    .then((response) => {
      console.log(response);
    })
    .catch((error) => {
      console.log(error.message);
    });
  removeLoader();
  connectButton.style.display = 'none';
};

talkButton.addEventListener('click', speakText)

async function speakText(textToSpeak) {
  // connectionState not supported in firefox
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
    let textBox = document.getElementById("questionByUse");
    textToSpeak = textBox.value || textToSpeak;
    console.log("textToSpeak", textToSpeak);

    if (!textToSpeak)
      alert("No text found for the person to speak...")

    await fetchWithRetries(`${DID_API.url}/talks/streams/${streamId}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script: {
          // type: 'audio',
          // audio_url: 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/webrtc.mp3',
          type: "text",
          provider: {
            type: "amazon",
            voice_id: "Justin"
          },
          ssml: false,
          input: textToSpeak.value || "Hi there, my name is Ujjwal Pandey, I am a big fan of anime, and I am a Web Developer"
        },
        // driver_url: 'bank://lively/',
        config: {
          stitch: true,
          fluent: false,
        },
        session_id: sessionId,
      }),
    })
      .then((talkResp) => {
        console.log("talkResp", talkResp);
        return talkResp.json();
      })
      .then((talkResp) => {
        console.log("talkResp2", talkResp);
      })
      .catch(err => {
        console.log(err.message);
      });
  } alert("Not connected...")
};

const destroyButton = document.getElementById('destroy-button');
destroyButton.addEventListener('click', destroyConnection);

async function destroyConnection() {
  console.log({ streamId, sessionId, Authorization: `Basic ${DID_API.key}` });
  if (!streamId || !sessionId) return;

  console.log("Deleting1");
  await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${DID_API.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId }),
  })
    .then((e) => {
      console.log(e);
      e.json()
    })
    .then(e => {
      console.log(e);
    })
    .catch(car => {
      console.log(car.message);
    })
    ;

  stopAllStreams();
  closePC();
};

function onIceGatheringStateChange() {
  iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
  iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}
function onIceCandidate(event) {
  console.log('onIceCandidate', event);
  if (event.candidate) {
    const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

    fetch(`${DID_API.url}/talks/streams/${streamId}/ice`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate,
        sdpMid,
        sdpMLineIndex,
        session_id: sessionId,
      }),
    })
      .then((label) => {
        console.log("++++++", label);
        return label.json();
      })
      .then((man) => {
        console.log("============", man);
      });
  }
}
function onIceConnectionStateChange() {
  iceStatusLabel.innerText = peerConnection.iceConnectionState;
  iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
  if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
    stopAllStreams();
    closePC();
  }
}
function onConnectionStateChange() {
  // not supported in firefox
  peerStatusLabel.innerText = peerConnection.connectionState;
  peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}
function onSignalingStateChange() {
  signalingStatusLabel.innerText = peerConnection.signalingState;
  signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}

function onVideoStatusChange(videoIsPlaying, stream) {
  let status;
  if (videoIsPlaying) {
    status = 'streaming';
    const remoteStream = stream;
    setVideoElement(remoteStream);
  } else {
    status = 'empty';
    playIdleVideo();
  }
  streamingStatusLabel.innerText = status;
  streamingStatusLabel.className = 'streamingState-' + status;
}

function onTrack(event) {
  if (!event.track)
    return;
  console.log(event.track);
  console.log(peerConnection.getStats(event.track));
  statsIntervalId = setInterval(async () => {
    const stats = await peerConnection.getStats(event.track);
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        const videoStatusChanged = videoIsPlaying !== report.bytesReceived > lastBytesReceived;

        if (videoStatusChanged) {
          videoIsPlaying = report.bytesReceived > lastBytesReceived;
          onVideoStatusChange(videoIsPlaying, event.streams[0]);
        }
        lastBytesReceived = report.bytesReceived;
      }
    });
  }, 500);
}

async function createPeerConnection(offer, iceServers) {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection({ iceServers });
    peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    peerConnection.addEventListener('icecandidate', onIceCandidate, true);
    peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
    peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
    peerConnection.addEventListener('track', onTrack, true);
  }

  await peerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');

  const sessionClientAnswer = await peerConnection.createAnswer();
  console.log('create local sdp OK');

  await peerConnection.setLocalDescription(sessionClientAnswer);
  console.log('set local sdp OK', sessionClientAnswer);

  return sessionClientAnswer;
}

function setVideoElement(stream) {
  if (!stream) return;
  talkVideo.srcObject = stream;
  talkVideo.loop = false;

  // safari hotfix
  if (talkVideo.paused) {
    talkVideo
      .play()
      .then((_) => { })
      .catch((e) => { });
  }
}

function playIdleVideo() {
  talkVideo.srcObject = undefined;
  talkVideo.src = './justin/or_idle.mp4';
  talkVideo.loop = true;
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    console.log('stopping all video streams');
    talkVideo.srcObject.getTracks().forEach((track) => track.stop());
    talkVideo.srcObject = null;
    console.log("Stopped video streams");
  }
}

function closePC(pc = peerConnection) {
  if (!pc) return;
  console.log('stopping peer connection');
  pc.close();
  pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
  pc.removeEventListener('icecandidate', onIceCandidate, true);
  pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
  pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
  pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
  pc.removeEventListener('track', onTrack, true);
  clearInterval(statsIntervalId);
  iceGatheringStatusLabel.innerText = '';
  signalingStatusLabel.innerText = '';
  iceStatusLabel.innerText = '';
  peerStatusLabel.innerText = '';
  console.log('stopped peer connection');
  if (pc === peerConnection) {
    peerConnection = null;
  }
}

const maxRetryCount = 3;
const maxDelaySec = 4;

async function fetchWithRetries(url, options, retries = 1) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries <= maxRetryCount) {
      const delay = Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) * 1000;

      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(`Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`);
      return fetchWithRetries(url, options, retries + 1);
    } else {
      throw new Error(`Max retries exceeded. error: ${err}`);
    }
  }
}

/*
window.addEventListener('unload', pageUnload);
window.addEventListener('beforeunload', pageUnload);
async function pageUnload(event) {
  await destroyConnection();
  const confirmationMessage = 'Are you sure you want to leave????';
  event.returnValue = confirmationMessage;
  return confirmationMessage;
}*/

// Testing
window.addEventListener('load', (event) => {
  return
  var data = {
    "streamId": "strm_eFLEE-LGzkdkcSsslmZDa",
    "sessionId": "AWSALB=IGU9S8lv6fGhRuR5F/ihZxh7tpUXwA/pCZx3XBWj2xEWNPbuAcexdAHqjGPYFhYXtM4qiUZxaw8p7Rh5hA9fGD9BNDDn8PxZNT5w/UNI9OvC9G8PFeaRhuJSQdaR; Expires=Thu, 07 Dec 2023 12:15:57 GMT; Path=/; AWSALBCORS=IGU9S8lv6fGhRuR5F/ihZxh7tpUXwA/pCZx3XBWj2xEWNPbuAcexdAHqjGPYFhYXtM4qiUZxaw8p7Rh5hA9fGD9BNDDn8PxZNT5w/UNI9OvC9G8PFeaRhuJSQdaR; Expires=Thu, 07 Dec 2023 12:15:57 GMT; Path=/; SameSite=None; Secure",
    "Authorization": "Basic c2FuamF5LmNoYWRoYUBzYWZldHlsYWJzLm9yZw:TeMen4hZwvoUa2F6hPL1R"
  }

  const options = {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: data.Authorization
    },
    body: JSON.stringify({
      session_id: data.sessionId
    })
  };

  console.log("+++++++++++Deleting\n\n", options);
  fetch('https://api.d-id.com/talks/streams/' + data.streamId, options)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));
})