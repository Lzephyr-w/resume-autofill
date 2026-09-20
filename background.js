chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id != null) await chrome.sidePanel.open({ tabId: tab.id });
});
