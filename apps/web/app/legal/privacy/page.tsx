import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Privacy Policy · Block70",
  description: "How Block70 collects, uses, and protects your data. GDPR and data protection.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="2025-01-01"
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
          supervisory authority. To exercise these rights, contact us at the
          email below. We will respond within the time required by applicable
          law (e.g., one month under GDPR).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data deletion">
        <LegalParagraph>
          You may request deletion of your account and associated personal data
          by contacting us. We will delete or anonymize your data in accordance
          with our retention policy and applicable law, except where we must
          retain data for legal, security, or legitimate business purposes.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}
