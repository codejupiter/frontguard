import { expect, test, type Page } from "@playwright/test";

async function gotoSettled(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.113.${testInfo.workerIndex + 1}`,
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("fg_onboarding_done", "1");
  });
});

test("landing page presents the product and routes into the app", async ({
  page,
}) => {
  await gotoSettled(page, "/landing");

  await expect(page).toHaveTitle(/FrontGuard/);
  await expect(
    page.getByText("Interactive Security Education Platform"),
  ).toBeVisible();
  await expect(page.getByText("Hack it.")).toBeVisible();
  await expect(page.getByText("Fix it.")).toBeVisible();
  await expect(page.getByText("Ship it.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start Learning" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    page.getByRole("link", { name: "Explore Modules" }),
  ).toHaveAttribute("href", "#modules");
});

test("dashboard exposes the security modules and global mode switch", async ({
  page,
}) => {
  await gotoSettled(page, "/");

  await expect(
    page.getByRole("heading", { name: "FrontGuard" }),
  ).toBeVisible();
  await expect(page.getByText("Attack Mode Active")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: /critical XSS Playground/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: /high API Security/i }),
  ).toBeVisible();
  await expect(page.getByText("Security Log")).toBeVisible();

  await page
    .getByRole("button", { name: /^(Switch to Secure|Secure)$/ })
    .click();
  await expect(page.getByText("Secure Mode Active")).toBeVisible();
});

test("xss playground demonstrates attack and secure rendering", async ({
  page,
}) => {
  await gotoSettled(page, "/xss");

  await expect(
    page.getByRole("heading", { name: "XSS Playground" }),
  ).toBeVisible();
  await page
    .getByPlaceholder('Try: <img src=x onerror="alert(1)">')
    .fill('<div style="color:red;font-size:32px;font-weight:bold">HACKED</div>');
  await page.getByRole("button", { name: "Render" }).click();

  await expect(
    page.getByTestId("unsafe-xss-output").getByText("HACKED"),
  ).toBeVisible();
  await expect(
    page.getByText(/XSS payload injected via innerHTML/i),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /^(Switch to Secure|Secure)$/ })
    .click();
  await page.getByRole("button", { name: "Render" }).click();
  await expect(page.getByText(/XSS payload sanitized/i)).toBeVisible();
});

test("api security module shows the unauthenticated data leak", async ({
  page,
}) => {
  await gotoSettled(page, "/api-security");

  await expect(
    page.getByRole("heading", { name: "API Security Demo" }),
  ).toBeVisible();
  const logsResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/logs") &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Fetch Without Auth (exploit)" }).click();
  await expect((await logsResponse).status()).toBe(200);

  await expect(page.getByText("HTTP 200")).toBeVisible();
  await expect(page.getByTestId("api-response-body")).toContainText("ssn");
  await expect(
    page.getByText(/Unauthenticated request succeeded/i),
  ).toBeVisible();
});
