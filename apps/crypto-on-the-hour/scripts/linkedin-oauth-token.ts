/**
 * 3-legged OAuth: print authorize URL, read authorization code from stdin, exchange for tokens.
 * Env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, optional LINKEDIN_SCOPES
 */
import "dotenv/config";
import * as readline from "node:readline/promises";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name} in environment`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const clientId = requireEnv("LINKEDIN_CLIENT_ID");
  const clientSecret = requireEnv("LINKEDIN_CLIENT_SECRET");
  const redirect = process.env.LINKEDIN_REDIRECT_URI?.trim() || "http://localhost:5454/callback";
  const scopes = (process.env.LINKEDIN_SCOPES || "w_organization_social r_organization_social").trim();

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirect);
  authUrl.searchParams.set("scope", scopes);

  console.log("1) Add this redirect URL to your LinkedIn app (Auth tab) if you have not:\n");
  console.log(`   ${redirect}\n`);
  console.log("2) Open this URL in a browser, sign in, approve, then copy the `code` query param from the redirect:\n");
  console.log(authUrl.toString());
  console.log("");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("Authorization code: ")).trim();
  rl.close();

  if (!code) {
    console.error("No code provided");
    process.exit(1);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const raw = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("Non-JSON response:", res.status, raw.slice(0, 500));
    process.exit(1);
  }

  if (!res.ok) {
    console.error("Token exchange failed:", res.status, JSON.stringify(json, null, 2));
    process.exit(1);
  }

  console.log("\nToken response:");
  console.log(JSON.stringify(json, null, 2));

  const at = json.access_token;
  const rt = json.refresh_token;
  if (typeof at === "string" && at) {
    console.log("\n# Add to .env:");
    console.log(`LINKEDIN_ACCESS_TOKEN=${at}`);
  }
  if (typeof rt === "string" && rt) {
    console.log(`LINKEDIN_REFRESH_TOKEN=${rt}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
