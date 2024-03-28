
// relay messages from web page to background
window.addEventListener("message", (e) => {
  if (! (Array.isArray(e.data) && e.data[0].type.startsWith('fs_'))) return;
  chrome.runtime.sendMessage(e.data);
}, false);

(function injectCode(src) {

  const atLeastOne = (check) => {
    if (check == null) throw new Error("null error");
    return check;
  }

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(src);
  atLeastOne(document.head || document.documentElement).appendChild(script);
})('/fs_capture_controller.js')

