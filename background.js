chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id != null) await chrome.sidePanel.open({ tabId: tab.id });
});

const trustedClick = async (tabId, x, y, plain = false) => {
  const debuggee = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(debuggee, "1.3");
    attached = true;
    if (!plain) await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0, pointerType: "mouse" });
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", plain
      ? { type: "mousePressed", x, y, button: "left", clickCount: 1 }
      : { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
    await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", plain
      ? { type: "mouseReleased", x, y, button: "left", clickCount: 1 }
      : { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
    return { clicked: true };
  } catch (error) {
    return { clicked: false, reason: String(error?.message || error) };
  } finally {
    if (attached) try { await chrome.debugger.detach(debuggee); } catch {}
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "RESUME_AUTOFILL_REVIEW_FIELD" && sender.id === chrome.runtime.id && sender.tab?.id != null && sender.frameId === 0) {
    if (!Number.isInteger(message.frameId) || message.frameId < 0 || typeof message.key !== "string" || message.key.length > 160) { sendResponse({ located: false }); return; }
    const locator = message.locator;
    if (locator != null && (typeof locator.label !== "string" || locator.label.length > 160 || typeof locator.module !== "string" || locator.module.length > 160 || !Number.isInteger(locator.row) || locator.row < 0 || locator.row > 200)) { sendResponse({ located: false }); return; }
    (async () => {
      const located = await chrome.tabs.sendMessage(sender.tab.id, { type: "LOCATE_FIELD_V100", key: message.key, locator }, { frameId: message.frameId });
      if (!located?.located) return { located: false };
      await new Promise((resolve) => setTimeout(resolve, 150));
      const [active] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
      if (active?.id !== sender.tab.id) return { located: true };
      return { located: true, image: await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "jpeg", quality: 70 }) };
    })().then(sendResponse).catch(() => sendResponse({ located: false }));
    return true;
  }
  if (message?.type === "RESUME_AUTOFILL_PAGE_FILL_V100" && sender.id === chrome.runtime.id && sender.tab?.id != null && sender.frameId === 0) {
    (async () => {
      await chrome.sidePanel.open({ tabId: sender.tab.id });
      // Opening a side panel is asynchronous; wait only for its message listener.
      for (let attempt = 0; attempt < 15; attempt++) {
        try {
          const result = await chrome.runtime.sendMessage({ type: "RESUME_AUTOFILL_PAGE_RUN_V100", tabId: sender.tab.id });
          if (result) return result;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return { status: "侧栏尚未连接，请打开简历助手后重试。" };
    })().then(sendResponse).catch(() => sendResponse({ status: "无法打开简历助手侧栏，请通过工具栏打开后重试。" }));
    return true;
  }
  if (message?.type !== "RESUME_AUTOFILL_TRUSTED_CLICK" || sender.id !== chrome.runtime.id || sender.tab?.id == null) return;
  const { x, y, plain } = message;
  if (!Number.isFinite(x) || !Number.isFinite(y)) { sendResponse({ clicked: false }); return; }
  trustedClick(sender.tab.id, x, y, plain === true).then(sendResponse);
  return true;
});
