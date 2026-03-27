import Link from "next/link";
import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

const LEGAL_EMAIL = "legal@block70.com";

export const metadata = {
  title: "Privacy Policy · Block70",
  description: "How Block70 collects, uses, and protects your data. GDPR and data protection.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="2026-03-24"
    >
      <LegalSection title="Data collection">
        <LegalParagraph>
          We collect information you provide directly (e.g., when you register):
          <strong className="text-slate-200"> user accounts</strong> (email,
          name, password hash), and optionally{" "}
          <strong className="text-slate-200">wallet addresses</strong> if you
          connect a wallet for portfolio or tracking features. We collect{" "}
          <strong className="text-slate-200">analytics data</strong> (e.g., pages
          visited, features used) to improve our services. We use{" "}
          <strong className="text-slate-200">cookies and similar
          technologies</strong> for authentication, preferences, and analytics as
          described in our Cookie Policy. If you use our{" "}
          <strong className="text-slate-200">referral</strong> program, we store
          referral codes and source. <strong className="text-slate-200">API
          usage</strong> (requests, endpoints, API keys) is logged for rate
          limiting, security, and support.
        </LegalParagraph>
        <LegalParagraph>
          If you choose{" "}
          <strong className="text-slate-200">Sign in with LinkedIn</strong>{" "}
          (OpenID Connect), we receive information from LinkedIn to
          authenticate you and maintain your account, such as your LinkedIn
          subject identifier and the profile details LinkedIn provides under
          your consent (for example name, email, and profile picture), as shown
          on LinkedIn’s authorization screen. If you use features that{" "}
          <strong className="text-slate-200">share content to your LinkedIn</strong>{" "}
          member presence, we process the text, media, and related metadata you
          send through our services, and OAuth tokens needed to act on your
          behalf until you disconnect or they expire.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data storage">
        <LegalParagraph>
          Your data is stored on secure servers. We retain account data for as
          long as your account is active and for a reasonable period thereafter
          for legal and operational purposes. Analytics and API logs may be
          retained in aggregated or anonymized form.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Third-party services">
        <LegalParagraph>
          We may use third-party services for hosting, analytics, email,
          payment processing, and support. These providers process data on our
          behalf under agreements that require them to protect your data and use
          it only for the purposes we specify. We do not sell your personal
          data to third parties for their marketing.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="LinkedIn integration">
        <LegalParagraph>
          Block70 uses a LinkedIn Developer application that may access
          LinkedIn APIs in these ways: (1){" "}
          <strong className="text-slate-200">
            Publishing to our official company presence
          </strong>{" "}
          on LinkedIn when authorized by our administrators; we may store{" "}
          <strong className="text-slate-200">
            OAuth tokens and related credentials
          </strong>{" "}
          and the{" "}
          <strong className="text-slate-200">
            LinkedIn organization identifier
          </strong>{" "}
          needed to post on behalf of our page. (2){" "}
          <strong className="text-slate-200">Sign in with LinkedIn</strong> using
          OpenID Connect (for example the{" "}
          <strong className="text-slate-200">openid</strong> scope and user
          info endpoint) when you choose that sign-in option, to verify your
          identity and link or create your Block70 account. (3){" "}
          <strong className="text-slate-200">Share on LinkedIn</strong>{" "}
          capabilities—for example creating or updating posts, uploads, or
          reactions on <strong className="text-slate-200">your</strong> LinkedIn
          member presence when you connect your account and explicitly use those
          features (including scopes such as{" "}
          <strong className="text-slate-200">w_member_social</strong>
          where applicable). We use member LinkedIn data only to provide these
          features you initiate, not for unrelated third-party marketing.
        </LegalParagraph>
        <LegalParagraph>
          Credentials and LinkedIn-related data are stored on our secure
          infrastructure for as long as needed to operate each integration and
          as described under Data storage above. LinkedIn also processes
          information under its own policies; see{" "}
          <a
            href="https://www.linkedin.com/legal/privacy-policy"
            className="font-medium text-emerald-400 hover:underline"
            rel="noopener noreferrer"
          >
            LinkedIn’s Privacy Policy
          </a>{" "}
          and{" "}
          <a
            href="https://www.linkedin.com/legal/l/api-terms-of-use"
            className="font-medium text-emerald-400 hover:underline"
            rel="noopener noreferrer"
          >
            API Terms of Use
          </a>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Cookies">
        <LegalParagraph>
          We use cookies for authentication (keeping you logged in), analytics
          (understanding how the site is used), and preferences (e.g., theme).
          You can control cookies through your browser settings. Essential
          cookies are required for the service to function. See our Cookie
          Policy for details.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="User rights (GDPR and other laws)">
        <LegalParagraph>
          If you are in the European Economic Area, UK, or other jurisdictions
          with similar laws, you may have the right to: access your personal
          data; correct inaccurate data; request erasure (“right to be
          forgotten”); restrict or object to certain processing; data
          portability; and withdraw consent where processing is based on
          consent. You may also have the right to lodge a complaint with a
          supervisory authority. To exercise these rights, contact us at{" "}
          <a
            href={`mailto:${LEGAL_EMAIL}`}
            className="font-medium text-emerald-400 hover:underline"
          >
            {LEGAL_EMAIL}
          </a>
          . Further contact options are on our{" "}
          <Link
            href="/contact"
            className="font-medium text-emerald-400 hover:underline"
          >
            Contact
          </Link>{" "}
          page. We will respond within the time required by applicable law
          (e.g., one month under GDPR).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data deletion">
        <LegalParagraph>
          You may request deletion of your account and associated personal data
          by contacting us at{" "}
          <a
            href={`mailto:${LEGAL_EMAIL}`}
            className="font-medium text-emerald-400 hover:underline"
          >
            {LEGAL_EMAIL}
          </a>
          . We will delete or anonymize your data in accordance
          with our retention policy and applicable law, except where we must
          retain data for legal, security, or legitimate business purposes.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}
