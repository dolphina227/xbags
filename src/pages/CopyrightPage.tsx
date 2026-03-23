import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function CopyrightPage() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="text-3xl font-bold mb-2">Copyright Notice</h1>
        <p className="text-muted-foreground text-sm mb-8">© {year} xBAGS. All rights reserved.</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Ownership</h2>
            <p>
              All content, design, graphics, interfaces, code, text, data, and other materials available
              on the xBAGS Platform are the exclusive property of xBAGS and its licensors, protected under
              applicable copyright, trademark, and intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Protected Works</h2>
            <p>The following are protected under copyright and may not be reproduced without permission:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>xBAGS logo, brand identity, and visual design</li>
              <li>Platform interface, layout, and user experience design</li>
              <li>Written content, documentation, and marketing materials</li>
              <li>Source code, smart contracts, and backend infrastructure</li>
              <li>Original data compilations and analytics features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Permitted Use</h2>
            <p>
              You may view and interact with the Platform for personal, non-commercial use. You may share
              links to xBAGS content with proper attribution. Screenshots may be used for non-commercial
              educational or informational purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Prohibited Use</h2>
            <p>Without prior written permission, you may not:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Reproduce, distribute, or republish xBAGS content</li>
              <li>Use xBAGS brand assets for commercial purposes</li>
              <li>Create derivative works based on xBAGS materials</li>
              <li>Claim ownership of any xBAGS intellectual property</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">User-Generated Content</h2>
            <p>
              By posting content on xBAGS, you grant us a worldwide, non-exclusive, royalty-free license
              to use, display, and distribute your content within the Platform. You retain ownership of
              your original content and are responsible for ensuring it does not infringe third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Token Distribution</h2>
            <p>
              xBAGS distributes $XBAGS tokens to users as rewards. The token distribution wallet address
              and associated smart contracts are disclosed in compliance with applicable regulations.
              Token rewards do not constitute securities or investment instruments.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">DMCA / Infringement Claims</h2>
            <p>
              If you believe your copyright has been infringed, please send a notice to{" "}
              <a href="mailto:xbags.social@gmail.com" className="text-primary hover:underline">
                xbags.social@gmail.com
              </a>{" "}
              with a description of the copyrighted work, the infringing content, and your contact information.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}