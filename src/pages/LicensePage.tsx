import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function LicensePage() {
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

        <h1 className="text-3xl font-bold mb-2">License</h1>
        <p className="text-muted-foreground text-sm mb-8">Effective Date: March 12 2026</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Software License Agreement</h2>
            <p>
              xBAGS ("the Platform") and all associated software, code, interfaces, and content are proprietary
              to xBAGS and its developers. This License governs your use of the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Grant of License</h2>
            <p>
              xBAGS grants you a limited, non-exclusive, non-transferable, revocable license to access and
              use the Platform solely for your personal, non-commercial purposes in accordance with these terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Restrictions</h2>
            <p>You may not:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Copy, modify, or distribute the Platform's source code or content</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
              <li>Use the Platform for any commercial purpose without written consent</li>
              <li>Remove or alter any proprietary notices or labels</li>
              <li>Use automated tools to scrape, crawl, or extract data from the Platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. Third-Party Components</h2>
            <p>
              The Platform may incorporate open-source software components. Such components are subject to
              their respective licenses. A list of third-party licenses is available upon request.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Blockchain & Smart Contracts</h2>
            <p>
              Interactions with the Solana blockchain, including token transactions and smart contract calls,
              are governed by the immutable nature of blockchain technology. xBAGS is not responsible for
              on-chain actions executed by users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Termination</h2>
            <p>
              This license is effective until terminated. Your rights under this license will terminate
              automatically without notice if you fail to comply with any of its terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Disclaimer</h2>
            <p>
              The Platform is provided "as is" without warranty of any kind. xBAGS does not warrant that
              the Platform will be uninterrupted, error-free, or free of viruses or other harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Contact</h2>
            <p>
              For licensing inquiries, please contact us at{" "}
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