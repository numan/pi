import reloadOnUpdate from 'virtual:reload-on-update-in-background-script';
import 'webextension-polyfill';

reloadOnUpdate('pages/background');

/**
 * Extension reloading is necessary because the browser automatically caches the css.
 * If you do not use the css of the content script, please delete it.
 */
reloadOnUpdate('pages/content/style.scss');

console.log('Background script loaded');

/**
 * Tracks when a service worker was last alive and extends the service worker
 * lifetime by writing the current time to extension storage every 20 seconds.
 * You should still prepare for unexpected termination - for example, if the
 * extension process crashes or your extension is manually stopped at
 * chrome://serviceworker-internals.
 */
let heartbeatInterval;

async function runHeartbeat() {
  await chrome.storage.local.set({ 'last-heartbeat': new Date().getTime() });
}

/**
 * Starts the heartbeat interval which keeps the service worker alive. Call
 * this sparingly when you are doing work which requires persistence, and call
 * stopHeartbeat once that work is complete.
 */
async function startHeartbeat() {
  // Run the heartbeat once at service worker startup.
  runHeartbeat().then(() => {
    // Then again every 20 seconds.
    heartbeatInterval = setInterval(runHeartbeat, 20 * 1000);
  });
}

async function stopHeartbeat() {
  clearInterval(heartbeatInterval);
}

/**
 * Returns the last heartbeat stored in extension storage, or undefined if
 * the heartbeat has never run before.
 */
async function getLastHeartbeat() {
  return (await chrome.storage.local.get('last-heartbeat'))['last-heartbeat'];
}

const tabsReady = {};

let mapBounds = null;

const sendMapBounds = function (tabId) {
  console.log('sending map bounds', tabId);
  if (!tabsReady[tabId]) {
    return;
  }
  if (!mapBounds) {
    return;
  }

  chrome.tabs.sendMessage(tabId, {
    topic: 'map-changed',
    mapState: mapBounds,
  });
};

chrome.runtime.onMessage.addListener((msg, sender) => {
  console.log('background script received message', msg, sender);
  // Listen for the content script to announce it's ready
  if (msg.topic === 'content-script-ready' && sender.tab) {
    tabsReady[sender.tab.id] = true;
    sendMapBounds(sender.tab.id);
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.method === 'PUT' && details.url.indexOf('async-create-search-page-state') !== -1) {
      // Convert the ArrayBuffer to a string
      const decoder = new TextDecoder('utf-8');
      const requestBodyString = decoder.decode(details.requestBody.raw[0].bytes);

      // Parse the string into an object
      const requestBodyObject = JSON.parse(requestBodyString);

      mapBounds = requestBodyObject;
      console.log('sending updated map bounds from intercepted request', mapBounds);
      sendMapBounds(details.tabId);
    }
  },
  { urls: ['*://*.zillow.com/*'] },
  ['requestBody'],
);
