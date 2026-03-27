# LinkedIn Company Page posting (developer setup)

This runbook matches [developer.linkedin.com](https://developer.linkedin.com/) and Microsoft Learn’s [UGC Post API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api) permissions. The worker posts via [`src/publishers/linkedin.publisher.ts`](../src/publishers/linkedin.publisher.ts) using `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_ORG_URN`.

**Note:** Microsoft Learn marks UGC Post as legacy; long term you may migrate to the [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api). This guide still matches the current code.

## 1. Create the app (developer hub)

1. Open [https://developer.linkedin.com/](https://developer.linkedin.com/) and sign in with a member who will administer the LinkedIn app **and** has a valid role on the target Company Page (see step 5).
2. Click **Create app** (or **My apps** → create).
3. Complete the form: app name, **LinkedIn Page** (associate your Company Page), privacy policy URL, app logo, legal agreements.

## 2. Request products and scopes

1. In the app’s **Products** tab, request access to capabilities that include **posting on behalf of an organization** (Marketing / community-management style products; exact labels change—use whatever grants **`w_organization_social`**).
2. Wait for any **in-review** states LinkedIn shows. Production use may require additional checks; the portal is authoritative.
3. Under **Auth**, note **Client ID** and **Client Secret**.

Required scope for org posts (see Learn docs): **`w_organization_social`**.  
Useful for listing pages you administer: **`r_organization_social`**.

Add authorized **redirect URLs** for OAuth (example): `http://localhost:5454/callback` (must match `LINKEDIN_REDIRECT_URI` when you run `npm run linkedin:oauth`).

## 3. OAuth: get `LINKEDIN_ACCESS_TOKEN`

1. Copy [`.env.example`](../.env.example) values into `.env` for:
   - `LINKEDIN_CLIENT_ID`
   - `LINKEDIN_CLIENT_SECRET`
   - `LINKEDIN_REDIRECT_URI` (must be registered on the app)
   - Optionally `LINKEDIN_SCOPES` (default `w_organization_social r_organization_social`)
2. From `apps/crypto-on-the-hour`:

   ```bash
   npm run linkedin:oauth
   ```

3. Open the printed URL, approve the app, copy the **`code`** query parameter from the browser address bar after redirect.
4. Paste the code into the terminal. The script prints `access_token` and often `refresh_token`. Set:

   ```env
   LINKEDIN_ACCESS_TOKEN=<access_token>
   ```

5. If LinkedIn returns a **refresh token**, store it as `LINKEDIN_REFRESH_TOKEN` and refresh before expiry (automation not included in this repo yet).

## 4. Resolve `LINKEDIN_ORG_URN`

The `author` field must be an **Organization URN**, e.g. `urn:li:organization:12345678`.

1. Ensure `LINKEDIN_ACCESS_TOKEN` is in `.env`.
2. Run:

   ```bash
   npm run linkedin:list-orgs
   ```

3. Copy the URN for your Company Page into `.env`:

   ```env
   LINKEDIN_ORG_URN=urn:li:organization:YOUR_ID
   ```

If you get **403**, confirm the token includes **`r_organization_social`** (or the product allows the `organizationAcls` finder) and your member still has **ADMINISTRATOR** (or another eligible role per Learn) on that page.

## 5. Company Page roles (human prerequisite)

Per Microsoft Learn, **`w_organization_social`** applies to organizations where the authenticated member has one of:

- **ADMINISTRATOR**
- **DIRECT_SPONSORED_CONTENT_POSTER**
- **RECRUITING_POSTER**

The OAuth user must match that requirement for the target page.

## 6. Verify on the worker

1. Set on the **same host** that runs `publishTopicBundle` (typically the crypto-on-the-hour worker):

   ```env
   LINKEDIN_ACCESS_TOKEN=...
   LINKEDIN_ORG_URN=urn:li:organization:...
   ```

2. Trigger a publish (hourly worker or `POST /admin/trigger-hourly` if configured).
3. On failure, logs show `LinkedIn {status}: {body}` from the publisher.

**Costs:** Organic posts are not billed per post like ads; time and API approval are the main costs.

## Quick links

- [developer.linkedin.com](https://developer.linkedin.com/)
- [UGC Post API — permissions](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api)
