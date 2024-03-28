// Initialize vars
let isValidTab = false;
let currentTab = null;

// Define dynamic page elements
const statusBall = document.getElementById('status-ball');
const status = document.getElementById('status'); //span
const siteOrgIdText = document.getElementById('siteOrgId'); //span
const urlText = document.getElementById('url'); //div
const orgId = document.getElementById('orgId'); //input
const save = document.getElementById('save');
const inject = document.getElementById('inject');
const stop = document.getElementById('stop');
const pause = document.getElementById('pause');
const resume = document.getElementById('resume');
const link = document.getElementById('link');

// Set up listener for background
const port = chrome.runtime.connect({ name: "_fs_controller" });
port.postMessage({connect: 'connect'});
port.onMessage.addListener((msg) => {
  switch(msg.type) {
    case "updateState":
      chrome.storage.sync.get("_fs_controller_state", ({_fs_controller_state}) => {
        setStatus({..._fs_controller_state});
        console.log(`Received request to update state to: ${JSON.stringify(_fs_controller_state)}`);
      });
      break;
    case "fs_link":
      copyLink(msg.data);
      break;
  }
})

// Helper functions
const relayMessage = (text, args)=>{
  window.postMessage({ type: text, args: (args ? [...args] : []) })
};

const getCachedLink = async () => {
  const { _fs_controller_state: {isRunning}} = await chrome.storage.sync.get("_fs_controller_state");
  const { _fs_controller_link } = await chrome.storage.sync.get("_fs_controller_link");
  return (!isRunning && _fs_controller_link) ? _fs_controller_link : "";
}

const copyLink = async (link) => {
  const cb = navigator.clipboard;
  await cb.writeText(link);
  alert('Text copied');
}

// Initialize UI defaults
(async () => {
  chrome.storage.sync.get("_fs_controller_orgId", ({_fs_controller_orgId}) => {
    orgId.value = _fs_controller_orgId ? _fs_controller_orgId : "";
  });

  // Determine if a valid tab
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    currentTab = tabs[0];
    const { url } = currentTab;
    isValidTab = (url.startsWith('http:') || url.startsWith('https:'))

    if (isValidTab) {
      // Trigger state refresh for popup start
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        func: relayMessage,
        args: ['_fs_capture_controller_getStatus']
      });

      // Lock down inject listener to only valid tabs
      inject.addEventListener("click", async () => {
        chrome.storage.sync.set({_fs_controller_recording: true});
        chrome.storage.sync.get("_fs_controller_orgId", async ({_fs_controller_orgId}) => {
          await chrome.scripting.executeScript({
            target: {tabId: currentTab.id},
            func: relayMessage,
            args: ['_fs_capture_controller_inject', [ _fs_controller_orgId, true ]],
          });
        });
        inject.disabled = true;
      });

    }
  });

})();

// Set up event listeners
save.addEventListener("click", async () => {
  const _fs_controller_orgId = orgId.value;
  chrome.storage.sync.set({_fs_controller_orgId});
});

stop.addEventListener("click", async () => {
  chrome.storage.sync.set({_fs_controller_recording: false});
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    func: relayMessage,
    args: ['_fs_capture_controller_pause', [true]],
  });
});

pause.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    func: relayMessage,
    args: ['_fs_capture_controller_pause', [false]],
  });
});

resume.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  //chrome.tabs.sendMessage(tab.id, {"message": "resume"}, console.log);
  await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    func: relayMessage,
    args: ['_fs_capture_controller_resume'],
  });
  resume.disabled = true;
});

link.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  //chrome.tabs.sendMessage(tab.id, {"message": "resume"}, console.log);
  const link = await getCachedLink();
  if (link) {
    await copyLink(link);
  } else {
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: relayMessage,
      args: ['_fs_capture_controller_link'],
    });
  }
});


// Update UI from state
const setStatus = (state) => {
  const { isLoaded, isRunning, url, siteOrgId } = state;
  if (isRunning) {
    resume.hidden = true;
    pause.disabled = false;
    pause.hidden = false;
  } else {
    resume.disabled = false;
    resume.hidden = false;
    pause.hidden = true;
  }
  if (isLoaded) {
    status.innerHTML = "";
    pause.disabled = false;
    statusBall.classList.remove('not-loaded');
    statusBall.classList.add('loaded');
    inject.disabled = true;
    stop.disabled = false;
    link.disabled = false;
  } else {
    // overrides when not loaded
    resume.disabled = true;
    pause.disabled = true;
    resume.hidden = false;
    pause.hidden = true;
    stop.disabled = true;
    link.disabled = true;

    status.innerHTML = "not";
    statusBall.classList.remove('loaded');
    statusBall.classList.add('not-loaded');
    inject.disabled = false;
  }
  siteOrgIdText.innerHTML = siteOrgId ? ` [${siteOrgId}]`: "";
  urlText.innerHTML = url;
}

