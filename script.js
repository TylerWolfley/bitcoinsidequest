const QUEST_TOKEN_MINT = "";
const QUEST_TRADE_URL = "";
const QUEST_X_URL = "";
const QUEST_TELEGRAM_URL = "";
const REQUEST_TIMEOUT_MS = 10000;
const QUEST_LOG_STORAGE_KEY = "sidequest.log.preview";
const QUEST_LOG_MAX_LENGTH = 120;

const COPY = {
  mintNotLive: "Mint not live",
  mintUnavailable: "Supply unavailable",
  pairNotLive: "Pair not live",
  pairUnavailable: "Pair unavailable",
  unavailable: "Not reported",
};

const fields = {
  contract: document.querySelector("#terminal-contract"),
  liquidity: document.querySelector("#terminal-liquidity"),
  log: document.querySelector("#terminal-log"),
  marketCap: document.querySelector("#terminal-market-cap"),
  price: document.querySelector("#terminal-price"),
  status: document.querySelector(".terminal-status"),
  supply: document.querySelector("#terminal-supply"),
  volume: document.querySelector("#terminal-volume"),
  copyContract: document.querySelector("#copy-contract"),
  launchContract: document.querySelector("#launch-contract"),
  launchTelegram: document.querySelector("#launch-telegram"),
  launchTrade: document.querySelector("#launch-trade"),
  launchX: document.querySelector("#launch-x"),
  questCount: document.querySelector("#quest-count"),
  questEntry: document.querySelector("#quest-entry"),
  questForm: document.querySelector(".onchain-preview"),
  questMessage: document.querySelector("#quest-message"),
  questReceipt: document.querySelector("#quest-receipt"),
  questWrite: document.querySelector("#quest-write"),
  questStatus: document.querySelector("#quest-preview-status"),
};

const setText = (element, value) => {
  if (element && value !== undefined && value !== null && value !== "") {
    element.textContent = value;
  }
};

const setLog = (value) => {
  if (!fields.log || !value) {
    return;
  }

  const prompt = document.createElement("span");
  prompt.textContent = ">";
  fields.log.replaceChildren(prompt, ` ${value}`);
};

const setLaunchContract = (value, canCopy = false) => {
  setText(fields.launchContract, value);

  if (!fields.copyContract) {
    return;
  }

  fields.copyContract.dataset.copyValue = canCopy ? value : "";
  fields.copyContract.disabled = !canCopy;
  fields.copyContract.textContent = canCopy ? "Copy" : "Copy when live";
};

const setLaunchLink = (element, url, label, placeholder) => {
  if (!element) {
    return;
  }

  if (url) {
    element.href = url;
    element.target = "_blank";
    element.rel = "noreferrer";
    element.textContent = label;
    element.classList.remove("is-disabled");
    element.removeAttribute("aria-disabled");
    return;
  }

  element.removeAttribute("href");
  element.removeAttribute("target");
  element.removeAttribute("rel");
  element.textContent = placeholder;
  element.classList.add("is-disabled");
  element.setAttribute("aria-disabled", "true");
};

const setLaunchLinks = () => {
  setLaunchLink(fields.launchTrade, QUEST_TRADE_URL, "Trade link", "Pair not live");
  setLaunchLink(fields.launchX, QUEST_X_URL, "X account", "Handle pending");
  setLaunchLink(fields.launchTelegram, QUEST_TELEGRAM_URL, "Telegram", "Chat pending");
};

const setPreLaunchState = () => {
  setText(fields.status, "Pre-launch");
  setText(fields.price, COPY.pairNotLive);
  setText(fields.supply, COPY.mintNotLive);
  setText(fields.liquidity, COPY.pairNotLive);
  setText(fields.marketCap, COPY.pairNotLive);
  setText(fields.volume, COPY.pairNotLive);
  setText(fields.contract, "Mint not public");
  setLaunchContract("Mint not public");
  setLaunchLinks();
  setLog("metrics wake up when the QUEST mint and pair are public");
};

const setPairNotLive = () => {
  setText(fields.price, COPY.pairNotLive);
  setText(fields.liquidity, COPY.pairNotLive);
  setText(fields.marketCap, COPY.pairNotLive);
  setText(fields.volume, COPY.pairNotLive);
};

const setPairUnavailable = () => {
  setText(fields.price, COPY.pairUnavailable);
  setText(fields.liquidity, COPY.pairUnavailable);
  setText(fields.marketCap, COPY.pairUnavailable);
  setText(fields.volume, COPY.pairUnavailable);
};

const setSupplyUnavailable = () => {
  setText(fields.supply, COPY.mintUnavailable);
};

const requestJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
};

const formatCurrency = (value, compact = true) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return COPY.unavailable;
  }

  return new Intl.NumberFormat("en-US", {
    compactDisplay: "short",
    currency: "USD",
    maximumFractionDigits: number < 1 ? 8 : 2,
    notation: compact ? "compact" : "standard",
    style: "currency",
  }).format(number);
};

const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return COPY.mintUnavailable;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    notation: "compact",
  }).format(number);
};

const loadDexScreener = async (mint) => {
  const data = await requestJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  const pair = data.pairs?.find((item) => item.chainId === "solana") ?? data.pairs?.[0];

  if (!pair) {
    setPairNotLive();
    return { pairFound: false };
  }

  setText(fields.price, formatCurrency(pair.priceUsd, false));
  setText(fields.liquidity, formatCurrency(pair.liquidity?.usd));
  setText(fields.marketCap, formatCurrency(pair.marketCap ?? pair.fdv));
  setText(fields.volume, formatCurrency(pair.volume?.h24));
  setText(fields.contract, pair.baseToken?.address ?? mint);
  setLaunchLink(fields.launchTrade, QUEST_TRADE_URL || pair.url, "Pair link", "Pair not live");

  return { pairFound: true };
};

const loadSupply = async (mint) => {
  const data = await requestJson("https://api.mainnet-beta.solana.com", {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "getTokenSupply",
      params: [mint],
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (data.error) {
    throw new Error(data.error.message ?? "Solana RPC request failed");
  }

  const supply = data.result?.value?.uiAmountString;
  setText(fields.supply, formatNumber(supply));

  return { supplyFound: Boolean(supply) };
};

const finishSync = (supplyResult, dexResult) => {
  const supplyOk = supplyResult.status === "fulfilled" && supplyResult.value.supplyFound;
  const dexOk = dexResult.status === "fulfilled";
  const pairFound = dexOk && dexResult.value.pairFound;

  if (supplyResult.status === "rejected") {
    setSupplyUnavailable();
  }

  if (dexResult.status === "rejected") {
    setPairUnavailable();
  }

  if (pairFound) {
    setText(fields.status, "Live pair");
    setLog(supplyOk ? "pair live. supply synced." : "pair live. supply unavailable.");
    return;
  }

  if (dexOk) {
    setText(fields.status, "Awaiting pair");
    setLog(supplyOk ? "mint synced. pair unlocks at liquidity." : "pair not live. supply unavailable.");
    return;
  }

  if (supplyOk) {
    setText(fields.status, "Pair unavailable");
    setLog("supply synced. pair data unavailable.");
    return;
  }

  setText(fields.status, "Data unavailable");
  setLog("terminal online. data sources unavailable.");
};

const syncTerminal = async (mint) => {
  setText(fields.contract, mint);
  setLaunchContract(mint, true);
  setLaunchLinks();
  setText(fields.status, "Syncing");
  setLog("syncing QUEST terminal...");

  const [supplyResult, dexResult] = await Promise.allSettled([
    loadSupply(mint),
    loadDexScreener(mint),
  ]);

  finishSync(supplyResult, dexResult);
};

if (!QUEST_TOKEN_MINT.trim()) {
  setPreLaunchState();
} else {
  syncTerminal(QUEST_TOKEN_MINT.trim());
}

fields.copyContract?.addEventListener("click", async () => {
  const value = fields.copyContract.dataset.copyValue;

  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    fields.copyContract.textContent = "Copied";
  } catch {
    fields.copyContract.textContent = "Copy failed";
  }
});

const createLocalReceipt = (message) => {
  let hash = 0x811c9dc5;
  const input = `${message}:${Date.now()}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `preview:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const setQuestPreview = (entry) => {
  if (!entry) {
    setText(fields.questReceipt, "pending");
    setText(fields.questEntry, "no entry written");
    return;
  }

  setText(fields.questReceipt, entry.receipt);
  setText(fields.questEntry, entry.message);
  setText(fields.questStatus, "preview written.");
};

const updateQuestCount = () => {
  if (!fields.questCount || !fields.questMessage) {
    return;
  }

  fields.questCount.textContent = `${fields.questMessage.value.length}/${QUEST_LOG_MAX_LENGTH}`;
};

const readStoredQuest = () => {
  try {
    const value = window.localStorage.getItem(QUEST_LOG_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const writeStoredQuest = (entry) => {
  try {
    window.localStorage.setItem(QUEST_LOG_STORAGE_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
};

setQuestPreview(readStoredQuest());
updateQuestCount();

fields.questMessage?.addEventListener("input", updateQuestCount);

fields.questForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = fields.questMessage?.value.trim() ?? "";

  if (!message) {
    setText(fields.questStatus, "write a short side quest first.");
    fields.questMessage?.focus();
    return;
  }

  const entry = {
    message,
    receipt: createLocalReceipt(message),
  };

  if (!writeStoredQuest(entry)) {
    setText(fields.questStatus, "preview unavailable. entry not saved.");
    return;
  }

  setQuestPreview(entry);
  setText(fields.questWrite, "preview written");
});
