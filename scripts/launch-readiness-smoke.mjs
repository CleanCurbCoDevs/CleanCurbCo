#!/usr/bin/env node

const baseUrl = (process.env.LAUNCH_AUDIT_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const publicRoutes = [
  "/",
  "/services",
  "/pricing",
  "/service-area",
  "/faq",
  "/book",
  "/contact",
  "/careers",
  "/privacy",
  "/terms",
  "/login",
  "/employee-login",
  "/reset-password",
  "/.well-known/security.txt",
];

const legalRoutes = [
  "/service-policy",
  "/payment-policy",
  "/cancellation-refund-policy",
  "/cookie-analytics-policy",
  "/communications-policy",
  "/accessibility",
  "/vulnerability-disclosure",
  "/commercial-services-addendum",
  "/door-to-door-cancellation-notice",
  "/field-safety-policy",
  "/photo-media-release",
];

const privateRoutes = [
  "/portal",
  "/portal/bookings",
  "/portal/photos",
  "/portal/billing",
  "/portal/account",
  "/portal/manage-service",
  "/admin",
  "/admin/bookings",
  "/admin/customers",
  "/admin/payments",
  "/admin/routes",
  "/admin/checklists",
  "/admin/settings",
  "/field/today",
];

const badNextValues = [
  "https://evil.example/admin",
  "//evil.example/admin",
  "%2F%2Fevil.example/admin",
  "%252F%252Fevil.example/admin",
  "javascript:alert(1)",
  "data:text/html,hi",
  "/\\evil.example",
  "/admin/../portal",
  "/login?next=https://evil.example",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}, jar = new Map()) {
  const headers = new Headers(options.headers || {});
  if (jar.size) {
    headers.set("cookie", [...jar].map(([key, value]) => `${key}=${value}`).join("; "));
  }

  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers,
  });

  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(";");
    const splitAt = pair.indexOf("=");
    if (splitAt > 0) jar.set(pair.slice(0, splitAt), pair.slice(splitAt + 1));
  }

  return {
    status: response.status,
    location: response.headers.get("location") || "",
    xRobotsTag: response.headers.get("x-robots-tag") || "",
    text: await response.text(),
  };
}

async function login(email, password, next = "/portal") {
  const jar = new Map();
  const response = await request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, next }),
    },
    jar,
  );
  const body = JSON.parse(response.text || "{}");
  return { jar, response, body };
}

async function checkPublicRoutes() {
  for (const route of [...publicRoutes, ...legalRoutes]) {
    const response = await request(route);
    assert(response.status === 200, `${route} expected 200, got ${response.status}`);
  }
}

async function checkRobotsAndSitemap() {
  const robots = await request("/robots.txt");
  assert(robots.text.includes("Disallow: /admin"), "robots.txt should disallow admin");
  assert(robots.text.includes("Disallow: /portal"), "robots.txt should disallow portal");
  assert(robots.text.includes("Disallow: /field"), "robots.txt should disallow field");

  const sitemap = await request("/sitemap.xml");
  for (const route of legalRoutes) {
    assert(sitemap.text.includes(`${baseUrl}${route}`) || sitemap.text.includes(`https://cleancurbco.com${route}`), `sitemap missing ${route}`);
  }
  for (const route of privateRoutes) {
    assert(!sitemap.text.includes(`${route}<`), `sitemap should not include private route ${route}`);
  }
}

async function checkRedirectHardening() {
  const email = process.env.CLEAN_CURB_ADMIN_EMAIL;
  const password = process.env.CLEAN_CURB_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipping redirect login checks: admin credentials not supplied.");
    return;
  }

  for (const next of badNextValues) {
    const { response, body } = await login(email, password, next);
    assert(response.status === 200, `login with bad next expected 200, got ${response.status}`);
    assert(body.redirectTo === "/admin", `bad next ${next} should fall back to /admin, got ${body.redirectTo}`);
  }
}

async function checkAuthenticatedRoutes() {
  const adminEmail = process.env.CLEAN_CURB_ADMIN_EMAIL;
  const adminPassword = process.env.CLEAN_CURB_ADMIN_PASSWORD;
  const customerEmail = process.env.CLEAN_CURB_CUSTOMER_EMAIL;
  const customerPassword = process.env.CLEAN_CURB_CUSTOMER_PASSWORD;

  if (!adminEmail || !adminPassword || !customerEmail || !customerPassword) {
    console.log("Skipping authenticated route checks: credentials not supplied.");
    return;
  }

  const customer = await login(customerEmail, customerPassword, "/portal");
  assert(customer.body.redirectTo === "/portal", "customer should land in portal");
  for (const route of ["/portal", "/portal/bookings", "/portal/photos", "/portal/billing"]) {
    const response = await request(route, {}, customer.jar);
    assert(response.status === 200, `customer ${route} expected 200, got ${response.status}`);
  }
  for (const route of ["/admin", "/admin/bookings", "/field/today"]) {
    const response = await request(route, {}, customer.jar);
    assert(response.status === 403, `customer ${route} expected 403, got ${response.status}`);
  }

  const admin = await login(adminEmail, adminPassword, "/admin");
  assert(admin.body.redirectTo === "/admin", "admin should land in admin");
  for (const route of ["/admin", "/admin/bookings", "/admin/customers", "/field/today"]) {
    const response = await request(route, {}, admin.jar);
    assert(response.status === 200, `admin ${route} expected 200, got ${response.status}`);
  }
}

async function checkOptimoRouteApiGuards() {
  const adminEmail = process.env.CLEAN_CURB_ADMIN_EMAIL;
  const adminPassword = process.env.CLEAN_CURB_ADMIN_PASSWORD;
  const customerEmail = process.env.CLEAN_CURB_CUSTOMER_EMAIL;
  const customerPassword = process.env.CLEAN_CURB_CUSTOMER_PASSWORD;
  const fakeRouteDayId = "11111111-1111-4111-8111-111111111111";

  const anonymous = await request("/api/admin/optimoroute/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ routeDayId: fakeRouteDayId }),
  });
  assert(
    anonymous.status === 401,
    `anonymous OptimoRoute sync expected 401, got ${anonymous.status}`,
  );

  const anonymousPreflight = await request("/api/admin/optimoroute/test-connection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert(
    anonymousPreflight.status === 401,
    `anonymous OptimoRoute preflight expected 401, got ${anonymousPreflight.status}`,
  );

  if (!adminEmail || !adminPassword || !customerEmail || !customerPassword) {
    console.log("Skipping OptimoRoute authenticated API guard checks: credentials not supplied.");
    return;
  }

  const customer = await login(customerEmail, customerPassword, "/portal");
  const customerResponse = await request(
    "/api/admin/optimoroute/sync",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routeDayId: fakeRouteDayId }),
    },
    customer.jar,
  );
  assert(
    customerResponse.status === 403,
    `customer OptimoRoute sync expected 403, got ${customerResponse.status}`,
  );

  const admin = await login(adminEmail, adminPassword, "/admin");
  const invalidInput = await request(
    "/api/admin/optimoroute/sync",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routeDayId: "not-a-route-day" }),
    },
    admin.jar,
  );
  assert(
    invalidInput.status === 400,
    `admin OptimoRoute bad input expected 400, got ${invalidInput.status}`,
  );
}

async function main() {
  console.log(`Launch smoke against ${baseUrl}`);
  await checkPublicRoutes();
  await checkRobotsAndSitemap();
  await checkRedirectHardening();
  await checkAuthenticatedRoutes();
  await checkOptimoRouteApiGuards();
  console.log("Launch smoke passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
