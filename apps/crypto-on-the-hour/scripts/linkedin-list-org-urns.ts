/**
 * List Organization URNs the authenticated member can administer (finder: roleAssignee).
 * Env: LINKEDIN_ACCESS_TOKEN
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role
 */
import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return v;
}

type OrgAclElement = {
  organization?: string;
  role?: string;
  state?: string;
  roleAssignee?: string;
};

type FinderResponse = {
  elements?: OrgAclElement[];
};

async function main() {
  const token = requireEnv("LINKEDIN_ACCESS_TOKEN");

  const candidates = [
    "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
    "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&state=APPROVED",
  ];

  let lastErr = "";
  for (const url of candidates) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      lastErr = `${res.status} ${text.slice(0, 400)}`;
      continue;
    }
    let data: FinderResponse;
    try {
      data = JSON.parse(text) as FinderResponse;
    } catch {
      console.error("Invalid JSON:", text.slice(0, 300));
      process.exit(1);
    }
    const elements = data.elements ?? [];
    if (!elements.length) {
      console.log("No organization ACL rows returned for:", url);
      continue;
    }
    console.log("Organization URNs (use one as LINKEDIN_ORG_URN):\n");
    for (const el of elements) {
      const org = el.organization ?? "(missing organization URN)";
      console.log(`  ${org}`);
      if (el.role) console.log(`      role: ${el.role}`);
      if (el.state) console.log(`      state: ${el.state}`);
    }
    console.log("\nExample .env:");
    const first = elements.find((e) => e.organization)?.organization;
    if (first) console.log(`LINKEDIN_ORG_URN=${first}`);
    return;
  }

  console.error("Could not list organizations. Last error:\n", lastErr);
  console.error(
    "\nCheck: token includes r_organization_social (or product access for organizationAcls), " +
      "and your LinkedIn user has ADMINISTRATOR (or eligible role) on the company page."
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
