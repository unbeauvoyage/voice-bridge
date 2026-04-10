const rules = [
  {
    name: "AI & Claude",
    color: "blue",
    match: (t) =>
      /claude|anthropic|openai|codex|chatgpt|ai agent|agent team|agent sdk|opus|sonnet|haiku|llm|gpt|mcp|langchain|ollama|turboquant|turing|vector db/i.test(
        t.title + " " + t.url
      ) &&
      !/invest|millionaire|economy|recession|wealth/i.test(t.title),
  },
  {
    name: "Game Dev",
    color: "green",
    match: (t) =>
      /game dev|unreal engine|unity|blender|three\.js|level design|modular character|art direction|craftmygame/i.test(
        t.title + " " + t.url
      ),
  },
  {
    name: "Investing & Finance",
    color: "yellow",
    match: (t) =>
      /invest|millionaire|bitcoin|gold|trading|wealth|economy|recession|stock|tesla|money|financial|income|dollar|asset/i.test(
        t.title
      ),
  },
  {
    name: "Geopolitics",
    color: "red",
    match: (t) =>
      /trump|iran|israel|war|ww.?ii|netanyahu|global economy|japan.*(mistake|counting)/i.test(
        t.title
      ),
  },
  {
    name: "Turkish / Religious",
    color: "purple",
    match: (t) =>
      /hocaefendi|gülen|cemaat|deccal|dünya savaşı|sahar|rabbi|zionism|islam|erzurum|hizmet|istanbul|istiklal/i.test(
        t.title + " " + t.url
      ),
  },
  {
    name: "Music",
    color: "orange",
    match: (t) => /suno\.com/i.test(t.url),
  },
  {
    name: "Dev Tools",
    color: "cyan",
    match: (t) =>
      /github|reddit.*claude|localhost|rust.*workflow|mac.*buy|apple.*日本/i.test(
        t.title + " " + t.url
      ),
  },
];

async function groupAllTabs() {
  const windows = await chrome.windows.getAll({ populate: true });

  for (const win of windows) {
    const tabs = win.tabs;
    const grouped = new Map();

    for (const tab of tabs) {
      let matched = false;
      for (const rule of rules) {
        if (rule.match(tab)) {
          if (!grouped.has(rule.name)) {
            grouped.set(rule.name, { rule, tabIds: [] });
          }
          grouped.get(rule.name).tabIds.push(tab.id);
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (!grouped.has("Other")) {
          grouped.set("Other", {
            rule: { name: "Other", color: "grey" },
            tabIds: [],
          });
        }
        grouped.get("Other").tabIds.push(tab.id);
      }
    }

    for (const [name, { rule, tabIds }] of grouped) {
      if (tabIds.length > 0) {
        const groupId = await chrome.tabs.group({
          tabIds,
          createProperties: { windowId: win.id },
        });
        await chrome.tabGroups.update(groupId, {
          title: rule.name,
          color: rule.color,
          collapsed: true,
        });
      }
    }
  }
}

chrome.action.onClicked.addListener(() => {
  groupAllTabs();
});

// Auto-run on install
chrome.runtime.onInstalled.addListener(() => {
  groupAllTabs();
});
