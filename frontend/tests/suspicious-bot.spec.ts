import { test } from "@playwright/test";

const BASE_URL = "https://172.20.10.6:3000";
const API_URL = "https://172.20.10.6:4000";

test("suspicious bot simulation", async ({ page, request }) => {

  console.log("1. 6 failed login attempts for ana)");
  for (let i = 0; i < 6; i++) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="identifier"]', "ana@gmail.com");
    await page.fill('input[name="password"]', `wrongpassword${i}`);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(800);
    console.log(`  Failed attempt ${i + 1}`);
  }

  console.log("2. Login with correct credentials as ana");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="identifier"]', "ana@gmail.com");
  await page.fill('input[name="password"]', "raluca");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log("3. Attempting to access forbidden admin pages");
  const adminRoutes = [
    "/admin",
    "/admin",
    "/admin",
    "/admin",
    "/admin",
    "/admin",
  ];
  for (let i = 0; i < adminRoutes.length; i++) {
    await page.goto(`${BASE_URL}${adminRoutes[i]}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    console.log(`  Forbidden probe ${i + 1}: ${adminRoutes[i]}`);
  }

  console.log("4. Attempting to access forbidden API endpoints directly");
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === "splitmates_session");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionCookie) headers["Cookie"] = `splitmates_session=${sessionCookie.value}`;

  const forbiddenApis = [
    "/api/admin/overview",
    "/api/admin/logs",
    "/api/admin/suspicious",
    "/api/admin/app-stats?optimized=false",
  ];

  for (const endpoint of forbiddenApis) {
    try {
      await request.get(`${API_URL}${endpoint}`, { headers, ignoreHTTPSErrors: true });
      console.log(`  API probe: ${endpoint}`);
    } catch {
      console.log(`  API probe failed (expected): ${endpoint}`);
    }
    await page.waitForTimeout(300);
  }

  console.log("5. Attempting to access different user's groups");
  for (let groupId = 1; groupId <= 5; groupId++) {
    await page.goto(`${BASE_URL}/groups/${groupId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    console.log(`  Group probe: /groups/${groupId}`);
  }
});