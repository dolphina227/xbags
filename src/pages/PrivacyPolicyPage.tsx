import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-8">Last updated: March 12 2026</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <p>
              xBAGS ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, and safeguard information when you use our Platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Information We Collect</h2>
            <p className="mb-2">We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong className="text-foreground">Wallet Address</strong> — your public Solana wallet
                address when you connect to the Platform
              </li>
              <li>
                <strong className="text-foreground">Profile Information</strong> — display name, username,
                bio, and avatar you choose to provide
              </li>
              <li>
                <strong className="text-foreground">Content</strong> — posts, comments, and interactions
                you create on the Platform
              </li>
              <li>
                <strong className="text-foreground">Usage Data</strong> — pages visited, features used,
                and interactions with the Platform
              </li>
              <li>
                <strong className="text-foreground">Referral Data</strong> — referral codes used and
                referrals generated
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To provide and maintain the Platform</li>
              <li>To display your public profile and content to other users</li>
              <li>To calculate and distribute $XBAGS token rewards</li>
              <li>To process referral bonuses and track leaderboard standings</li>
              <li>To improve Platform features and user experience</li>
              <li>To detect and prevent fraud, abuse, or security issues</li>
              <li>To communicate important updates about the Platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. Blockchain Data</h2>
            <p>
              Your wallet address and on-chain transactions are publicly visible on the Solana blockchain.
              We do not control blockchain data and cannot delete or modify it. We may display publicly
              available on-chain information as part of Platform features.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Data Sharing</h2>
            <p className="mb-2">We do not sell your personal data. We may share information with:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong className="text-foreground">Service Providers</strong> — third-party services
                that help us operate the Platform (e.g., Supabase, Helius, Solana RPC providers)
              </li>
              <li>
                <strong className="text-foreground">Legal Requirements</strong> — if required by law
                or to protect our rights
              </li>
              <li>
                <strong className="text-foreground">Business Transfers</strong> — in connection with
                a merger, acquisition, or sale of assets
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Data Storage & Security</h2>
            <p>
              Your data is stored securely using Supabase infrastructure with industry-standard encryption.
              We implement reasonable security measures to protect your information. However, no method
              of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Cookies & Local Storage</h2>
            <p>
              We use browser local storage to save preferences such as theme settings, token history,
              and referral codes. We do not use third-party advertising cookies. You can clear local
              storage through your browser settings at any time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Your Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at{" "}
              <a href="mailto:xbags.social@gmail.com" className="text-primary hover:underline">
                xbags.social@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Children's Privacy</h2>
            <p>
              xBAGS is not intended for users under 18 years of age. We do not knowingly collect
              personal information from minors. If you believe a minor has provided us with information,
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">9. Third-Party Links</h2>
            <p>
              The Platform may contain links to third-party websites (e.g., DexScreener, Solscan,
              Pump.fun). We are not responsible for the privacy practices of these sites and encourage
              you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of significant
              changes by posting a notice on the Platform. Continued use of xBAGS after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">11. Contact Us</h2>
            <p>
              For any privacy-related questions or concerns, please contact us at{" "}
              <a href="mailto:xbags.social@gmail.com" className="text-primary hover:underline">
                xbags.social@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}