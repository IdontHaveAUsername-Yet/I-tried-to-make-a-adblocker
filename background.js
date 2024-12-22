// Wildcard-Filter für Werbung
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

// Funktion zum Laden der Whitelist (asynchron)
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

// Überprüfen, ob eine URL auf der Whitelist ist
function isWhitelisted(url) {
  return whitelist.some((regex) => regex.test(url));
}

// Blockiere unerwünschte URLs (bei Anfragen)
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isWhitelisted(details.url)) {
      console.log("Whitelist erlaubt URL:", details.url);
      return; // Blockiere nicht, wenn URL auf der Whitelist steht
    }
    if (adFilters.some((filter) => filter.test(details.url))) {
      console.log("Blockiere Anfrage:", details.url);
      return { cancel: true };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Blockiere unerwünschte Weiterleitungen
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const redirectUrl = details.responseHeaders.find(
      (header) => header.name.toLowerCase() === "location"
    )?.value;

    if (redirectUrl && isWhitelisted(redirectUrl)) {
      console.log("Whitelist erlaubt Weiterleitung:", redirectUrl);
      return; // Blockiere nicht, wenn Weiterleitung auf der Whitelist steht
    }
    if (redirectUrl && adFilters.some((filter) => filter.test(redirectUrl))) {
      console.log("Blockiere Weiterleitung nach:", redirectUrl);
      return { cancel: true };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);

// Verzögertes Tab-Schließen für dynamische Inhalte
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && isWhitelisted(changeInfo.url)) {
    console.log("Whitelist erlaubt Tab-Update:", changeInfo.url);
    return; // Verhindert das Schließen des Tabs, wenn er auf der Whitelist steht
  }
  if (changeInfo.url && adFilters.some((filter) => filter.test(changeInfo.url))) {
    console.log("Blockiere Tab wegen Aktualisierung:", changeInfo.url);
    setTimeout(() => {
      browser.tabs.remove(tabId).catch(console.error);
    }, 200); // 200 ms Verzögerung für dynamische Inhalte
  }
});

// Tabs schließen, die beim Öffnen auf unerwünschte URLs zeigen
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
    }, 100); // Kleine Verzögerung für initiale Lade-URLs
  }
});

// Initialisiere die Whitelist beim Start
loadWhitelist();
