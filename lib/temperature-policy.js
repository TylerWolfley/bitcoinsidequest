// Reviewed, fixed sampling contract. Never infer exclusions from a failed feed.
export const TEMPERATURE_POLICY = {
  "version": "2026-10-23.1",
  "coins": {
    "ethereum": {
      "source": "dex",
      "markets": [
        {
          "id": "eth_0xe0554a476a092703abdb3ef35c80e0d76d32939f",
          "network": "eth",
          "address": "0xe0554a476a092703abdb3ef35c80e0d76d32939f",
          "base": "usd-coin",
          "quote": "ethereum"
        },
        {
          "id": "eth_0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
          "network": "eth",
          "address": "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
          "base": "ethereum",
          "quote": "usd-coin"
        },
        {
          "id": "eth_0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
          "network": "eth",
          "address": "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36",
          "base": "ethereum",
          "quote": "tether"
        },
        {
          "id": "eth_0x11b815efb8f581194ae79006d24e0d814b7697f6",
          "network": "eth",
          "address": "0x11b815efb8f581194ae79006d24e0d814b7697f6",
          "base": "ethereum",
          "quote": "tether"
        },
        {
          "id": "eth_0x769db46f39c42ee7ad5f71f4167c47edd281e767",
          "network": "eth",
          "address": "0x769db46f39c42ee7ad5f71f4167c47edd281e767",
          "base": "dai",
          "quote": "ethereum"
        }
      ]
    },
    "binancecoin": {
      "source": "exchange",
      "markets": [
        {
          "id": "binance:BNBUSDT",
          "base": "binancecoin",
          "quote": "tether"
        }
      ]
    },
    "ripple": {
      "source": "exchange",
      "markets": [
        {
          "id": "binance:XRPUSDT",
          "base": "ripple",
          "quote": "tether"
        }
      ]
    },
    "solana": {
      "source": "dex",
      "markets": [
        {
          "id": "solana_Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
          "network": "solana",
          "address": "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
          "base": "solana",
          "quote": "usd-coin"
        },
        {
          "id": "solana_3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv",
          "network": "solana",
          "address": "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv",
          "base": "solana",
          "quote": "usd-coin"
        },
        {
          "id": "solana_5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",
          "network": "solana",
          "address": "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",
          "base": "solana",
          "quote": "usd-coin"
        },
        {
          "id": "solana_DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ",
          "network": "solana",
          "address": "DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ",
          "base": "solana",
          "quote": "usd-coin"
        },
        {
          "id": "solana_3nMFwZXwY1s1M5s8vYAHqd4wGs4iSxXE4LRoUMMYqEgF",
          "network": "solana",
          "address": "3nMFwZXwY1s1M5s8vYAHqd4wGs4iSxXE4LRoUMMYqEgF",
          "base": "solana",
          "quote": "tether"
        }
      ]
    },
    "tron": {
      "source": "dex",
      "markets": [
        {
          "id": "tron_TSUUVjysXV8YqHytSNjfkNXnnB49QDvZpx",
          "network": "tron",
          "address": "TSUUVjysXV8YqHytSNjfkNXnnB49QDvZpx",
          "base": "tether",
          "quote": "tron"
        },
        {
          "id": "tron_TFGDbUyP8xez44C76fin3bn3Ss6jugoUwJ",
          "network": "tron",
          "address": "TFGDbUyP8xez44C76fin3bn3Ss6jugoUwJ",
          "base": "tether",
          "quote": "tron"
        }
      ]
    },
    "figure-heloc": {
      "source": "price-only",
      "reason": "No reviewed buy/sell feed. Included in both price checks."
    },
    "zcash": {
      "source": "exchange",
      "markets": [
        {
          "id": "binance:ZECUSDT",
          "base": "zcash",
          "quote": "tether"
        }
      ]
    },
    "hyperliquid": {
      "source": "dex",
      "markets": [
        {
          "id": "hyperevm_0x6c9a33e3b592c0d65b3ba59355d5be0d38259285",
          "network": "hyperevm",
          "address": "0x6c9a33e3b592c0d65b3ba59355d5be0d38259285",
          "base": "usd-coin",
          "quote": "hyperliquid"
        },
        {
          "id": "hyperevm_0xbe512f5881b85c48d9c17bc5bb2be047d156d696",
          "network": "hyperevm",
          "address": "0xbe512f5881b85c48d9c17bc5bb2be047d156d696",
          "base": "usd-coin",
          "quote": "hyperliquid"
        },
        {
          "id": "hyperevm_0x5a177cf0effb7e0e7115d792e587c1a5a9cbc9d4",
          "network": "hyperevm",
          "address": "0x5a177cf0effb7e0e7115d792e587c1a5a9cbc9d4",
          "base": "usd-coin",
          "quote": "hyperliquid"
        },
        {
          "id": "hyperevm_0x422e586c906eb241f784b4f5a633c2c7e59a2f54",
          "network": "hyperevm",
          "address": "0x422e586c906eb241f784b4f5a633c2c7e59a2f54",
          "base": "usd-coin",
          "quote": "hyperliquid"
        }
      ]
    },
    "dogecoin": {
      "source": "exchange",
      "markets": [
        {
          "id": "binance:DOGEUSDT",
          "base": "dogecoin",
          "quote": "tether"
        }
      ]
    },
    "monero": {
      "source": "exchange",
      "markets": [
        {
          "id": "kraken:XMRUSDT",
          "base": "monero",
          "quote": "tether"
        }
      ]
    }
  }
};
