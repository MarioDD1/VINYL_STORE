import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8010", channel: "msedge" },
  webServer: {
    command: "python ../tests/browser_server.py",
    url: "http://127.0.0.1:8010/api/state",
    reuseExistingServer: false,
  },
});
