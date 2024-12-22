const adFilters = [
  "*://*.doubleclick.net/*",
  "*://*.adservice.google.com/*",
  "*://*.googlesyndication.com/*",
  "*://*.facebook.com/ads/*",
  "*://*.adform.net/*",
  "*://*.adroll.com/*",
  "*://*.taboola.com/*",
  "*://*.outbrain.com/*",
  "*://*.revcontent.com/*",
  "*://*.zergnet.com/*",
  "*://*.popads.net/*",
  "*://*.media.net/*",
  "*://*.advertising.com/*",
  "*://*.moatads.com/*",
  "*://*.criteo.com/*",
  "*://*.eroticads.com/*",
  "*://*.gamesads.com/*",
  "*://*.freedesktopgames.net/*"
].map((pattern) => new RegExp(pattern.replace(/\*/g, ".*")));


let whitelist = [];

async function loadWhitelist() {
  try {
    const response = await fetch(browser.runtime.getURL("whitelist.json"));
    whitelist = (await response.json()).map((pattern) =>
      new RegExp(pattern.replace(/\*/g, ".*")) // Konvertiere Wildcards in Regex
    );
    console.log("Whitelist erfolgreich geladen:", whitelist.length, "Einträge");
  } catch (error) {
    console.error("Fehler beim Laden der Whitelist:", error);
  }
}


function isWhitelisted(url) {
  return whitelist.some((regex) => regex.test(url));
}


browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isWhitelisted(details.url)) {
      console.log("Whitelist erlaubt URL:", details.url);
      return;
    }
    if (adFilters.some((filter) => filter.test(details.url))) {
      console.log("Blockiere Anfrage:", details.url);
      return { cancel: true };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);


browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const redirectUrl = details.responseHeaders.find(
      (header) => header.name.toLowerCase() === "location"
    )?.value;

    if (redirectUrl && isWhitelisted(redirectUrl)) {
      console.log("Whitelist erlaubt Weiterleitung:", redirectUrl);
      return; 
    }
    if (redirectUrl && adFilters.some((filter) => filter.test(redirectUrl))) {
      console.log("Blockiere Weiterleitung nach:", redirectUrl);
      return { cancel: true };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);


browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && isWhitelisted(changeInfo.url)) {
    console.log("Whitelist erlaubt Tab-Update:", changeInfo.url);
    return; 
  }
  if (changeInfo.url && adFilters.some((filter) => filter.test(changeInfo.url))) {
    console.log("Blockiere Tab wegen Aktualisierung:", changeInfo.url);
    setTimeout(() => {
      browser.tabs.remove(tabId).catch(console.error);
    }, 200);
  }
});

// 
browser.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId !== undefined) {
    setTimeout(() => {
      browser.tabs.get(tab.id).then((updatedTab) => {
        if (
          updatedTab.url === "about:blank" ||
          isWhitelisted(updatedTab.url) ||
          adFilters.some((filter) => filter.test(updatedTab.url))
        ) {
          console.log("Schließe Tab:", updatedTab.url);
          browser.tabs.remove(updatedTab.id).catch(console.error);
        }
      });
    }, 100); 
  }
});


loadWhitelist();
