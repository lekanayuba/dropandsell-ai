chrome.runtime.onInstalled.addListener(() => {
  console.log('DropandSell AI extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on:', tab.url);
});
