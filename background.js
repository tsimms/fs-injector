let _fs_controller_port = null;

chrome.runtime.onInstalled.addListener(() => {
   chrome.storage.sync.set({_fs_controller_state: {
     isLoaded: false,
     isRunning: false,
     siteOrgId: "",
     url: "",
     link: ""
   }});
});

const triggerUpdate = async (url, tabId) => {
  if ((! url) || (! (url.startsWith('http:') || url.startsWith('https:')))) {
    setIcon(false);
  //  await setState({ url: "inactive" });
    return;
  }
  await setState({ url });
  console.log(`Triggering a status fetch for ${url}`);
  chrome.scripting.executeScript({
    target: {tabId},
    func: (text, args)=>{ window.postMessage({"type": text, "args": args ? [...args] : []}) },
    args: ['_fs_capture_controller_getStatus']
  });
}

// when tab changes, trigger status fetch
chrome.tabs.onActivated.addListener(async ({tabId , windowId}) => {
  await setRecording();
  chrome.tabs.get(tabId, async (tab) => {
    const { url } = tab;
    await triggerUpdate(url, tabId);
  });
});

// when url in tab changes or tab is refreshed, trigger status refresh
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const { url } = changeInfo;
  if (url) {
    console.log (`Looks like url has changed: ${url}`);
    await triggerUpdate(url, tabId);
  } else if (changeInfo.status === 'loading') {
    const refreshUrl = tab.pendingUrl || tab.url;
    console.log (`Looks like tab has refreshed: ${refreshUrl}`);
    await triggerUpdate(refreshUrl, tabId);
  }
});

chrome.runtime.onConnect.addListener((port) => {
  console.assert(port.name === "_fs_controller");
  _fs_controller_port = port;
  port.onDisconnect.addListener(obj => {
    _fs_controller_port = null;
  })
});

const getSavedOrgId = async () => {
  const { _fs_controller_orgId } = await chrome.storage.sync.get("_fs_controller_orgId");
  return (_fs_controller_orgId ? _fs_controller_orgId : "");
};

const getRecording = async () => {
  const { _fs_controller_recording } = await chrome.storage.sync.get("_fs_controller_recording");
  return _fs_controller_recording; 
};

chrome.runtime.onMessage.addListener(async (messages, sender, sendResponse) => {
  let doUpdate = false;
  for (let index=0; index<messages.length; index++) {
    let message = messages[index];
    console.log(`Processing message '${message.type}`);
    switch (message.type) {
      case 'fs_isLoaded':
        const [isLoaded, orgId] = message.data;
        setIcon(isLoaded);
        const siteOrgId = ((await getSavedOrgId()) !== orgId) ? orgId : "";
        await setState({ isLoaded });
        await setState({ siteOrgId });
        doUpdate = true;
        break;
      case 'fs_detected':
        console.log(`FS was detected on ${sender.url}`);
        setIcon(true);
        await setState({ isLoaded: true });
        break;
      case 'fs_undetected':
        console.log(`FS was undetected on ${sender.url}`);
        setIcon(false);
        await setState({ isLoaded: false });
        if (await getRecording()) {
          await doInjection(sender.tab.id);
        }
        break;
      case 'fs_isRunning':
        await setState({ isRunning: message.data });
        doUpdate = true;
        break;
      case 'fs_link':
        if (!_fs_controller_port) return;
        try {
          _fs_controller_port.postMessage({ type:'fs_link', data:message.data });
        } catch(e) {
          console.log(e);
          _fs_controller_port = null;
        }
        break;
      case 'fs_link_cache':
        await setLinkCache(message.data);
        break;
      default:
        return false;
        break;
    }
  };
  if (doUpdate) updateState();
});

const setIcon = (isRunning) => {
  const active_icon = "/images/icon_active_32.png";
  const inactive_icon = "/images/icon_32.png";
  chrome.action.setIcon({path: {32: isRunning? active_icon : inactive_icon}});
}

const setState = (prop) => new Promise((resolve, reject) => {
  chrome.storage.sync.get("_fs_controller_state", ({_fs_controller_state}) => {
    chrome.storage.sync.set({_fs_controller_state: {..._fs_controller_state, ...prop}}, () => {
      resolve();
    });
  })
});

const setRecording = () => new Promise((resolve, reject) => {
  chrome.storage.sync.set({_fs_controller_recording: false}, () => {
    resolve();
  });
});

const setLinkCache = (_fs_controller_link) => (
  chrome.storage.sync.set({_fs_controller_link})
);

const doInjection = (tabId) => new Promise((resolve, reject) => {
  chrome.storage.sync.get("_fs_controller_orgId", ({_fs_controller_orgId}) => {
    chrome.scripting.executeScript({
      target: {tabId},
      func: (text, args)=>{ window.postMessage({"type": text, "args": args ? [...args] : []}) },
      args: ['_fs_capture_controller_inject', [ _fs_controller_orgId, false ]]
    });
    resolve();
  });
});

// send state to popup
const updateState = () => {
  console.log(`Updating state in extension.`);
  if (!_fs_controller_port) return;
  try {
    _fs_controller_port.postMessage({ type: 'updateState' });
  } catch(e) {
    _fs_controller_port = null;
  }
}

