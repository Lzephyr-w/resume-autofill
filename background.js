chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id != null) await chrome.sidePanel.open({ tabId: tab.id });
});

const trustedClick = async (tabId, x, y) => {
  const debuggee = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(debuggee, "1.3");
    attached = true;
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    return { clicked: true };
  } catch {
    return { clicked: false };
  } finally {
    if (attached) try { await chrome.debugger.detach(debuggee); } catch {}
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "RESUME_AUTOFILL_TRUSTED_CLICK" || sender.id !== chrome.runtime.id || sender.tab?.id == null) return;
  const { x, y } = message;
  if (!Number.isFinite(x) || !Number.isFinite(y)) { sendResponse({ clicked: false }); return; }
  trustedClick(sender.tab.id, x, y).then(sendResponse);
  return true;
});
