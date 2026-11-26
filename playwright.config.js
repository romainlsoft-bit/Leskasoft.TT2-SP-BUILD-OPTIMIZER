import {defineConfig,devices} from "@playwright/test";

const local="http://127.0.0.1:8765";
const baseURL=process.env.TT2_E2E_BASE_URL||local;
export default defineConfig({
 testDir:"./e2e",
 timeout:60000,
 expect:{timeout:10000},
 workers:1,
 retries:0,
 reporter:[["list"],["html",{open:"never"}]],
 use:{baseURL,trace:"retain-on-failure",screenshot:"only-on-failure"},
projects: [
    {
        name: "chromium",
        use: {
            ...devices["Desktop Chrome"],
            channel: "chrome"
        }
    }
],
 webServer:process.env.TT2_E2E_BASE_URL?undefined:{
  command:"python -m http.server 8765 --bind 127.0.0.1",
  url:local,reuseExistingServer:false,timeout:30000
 }
});
