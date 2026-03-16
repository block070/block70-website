import {
  LegalPageLayout,
  LegalSection,
  LegalParagraph,
} from "@/components/legal/legal-page-layout";

export const metadata = {
  title: "Terms of Service · Block70",
  description: "Block70 Terms of Service. Information and analytics only; not financial advice.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="2025-01-01"
    >
      <LegalSection title="Introduction">
        <LegalParagraph>
          Welcome to Block70. These Terms of Service (“Terms”) govern your use of
          the Block70 platform, including our website, API, and services
          (collectively, “Services”). By using Block70, you agree to these
          Terms.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="text-slate-200">
            Block70 provides information and analytics only. Block70 does not
            provide financial, investment, legal, or tax advice. All content,
            signals, insights, and data are for informational and educational
            purposes only. You are solely responsible for your own investment
            and trading decisions.
          </strong>
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="User Accounts">
        <LegalParagraph>
          You must provide accurate information when creating an account. You
          are responsible for maintaining the confidentiality of your
          credentials and for all activity under your account. You must notify
          us promptly of any unauthorized use.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Acceptable Use">
        <LegalParagraph>
          You agree to use the Services only for lawful purposes. You may not
          use Block70 to violate any law, infringe others’ rights, distribute
          malware, attempt to gain unauthorized access to our systems or other
          users’ data, or use the Services in any way that could harm Block70 or
          its users.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Intellectual Property">
        <LegalParagraph>
          Block70 and its licensors own all rights in the Services, including
          software, design, content, and trademarks. You may not copy, modify,
          distribute, or create derivative works without our written permission.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="API Usage Rules">
        <LegalParagraph>
          Use of the Block70 API is subject to our API Terms (/legal/api-terms).
          You must comply with rate limits, usage policies, and any
          documentation we provide. We may suspend or revoke API access for
          violation of these Terms or the API Terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Community Content Rules">
        <LegalParagraph>
          User-generated content (e.g., alpha posts, strategy discussions) must
          comply with our Community Guidelines (/legal/community-guidelines). You
          may not post fraudulent, manipulative, or misleading content. We may
          remove content and suspend accounts that violate these rules.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Rewards System Terms">
        <LegalParagraph>
          Block70 may offer a rewards program (e.g., Blocks). Rewards have no
          cash value, are not redeemable for legal tender unless explicitly
          stated, and may be modified, paused, or discontinued. Abuse of the
          rewards system may result in forfeiture and account action. See
          Rewards Program Terms for full details.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Subscription Terms">
        <LegalParagraph>
          Paid subscriptions are billed according to the plan you select.
          Refunds are subject to our billing policy. We may change subscription
          fees with reasonable notice. Continued use after a fee change
          constitutes acceptance.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Termination">
        <LegalParagraph>
          We may suspend or terminate your account and access to the Services
          at any time for violation of these Terms or for any other reason. You
          may close your account at any time. Upon termination, your right to
          use the Services ceases immediately.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Limitation of Liability">
        <LegalParagraph>
          To the maximum extent permitted by law, Block70 and its affiliates,
          officers, and employees shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or for any
          loss of profits, data, or use, arising from your use of the Services
          or any content thereon. Our total liability shall not exceed the
          amount you paid us in the twelve (12) months preceding the claim.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Governing Law">
        <LegalParagraph>
          These Terms are governed by the laws of the United States and the
          State of Delaware, without regard to conflict of law principles.
          Disputes shall be resolved in the courts of Delaware. If you are in
          the European Union, mandatory consumer protection laws in your
          jurisdiction may apply.
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}
