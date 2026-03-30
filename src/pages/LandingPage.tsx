import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import landingBg from "@/assets/landing-bg.png";
import xbagsLogo from "@/assets/xbags-logo-new.png";

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,200;0,9..40,300&display=swap";
    document.head.appendChild(link);

    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      localStorage.setItem("xbags_ref", refCode);
    }
  }, []);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black"
      style={{
        backgroundImage: `url(${landingBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex flex-col items-center px-6 text-center max-w-2xl mx-auto"
      >
        {/* Logo - Lebih besar di mobile, negative margin untuk spacing PNG */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full flex justify-center"
        >
          <img 
            src={xbagsLogo} 
            alt="XBAGS" 
            className="h-40 md:h-48 lg:h-56 w-auto object-contain"
            style={{ 
              marginBottom: "-20px",
              marginTop: "-8px"
            }}
          />
        </motion.div>

        {/* Tagline - Jarak lebih pas dari logo */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-white/40 tracking-[0.25em] text-[11px] md:text-xs lg:text-sm font-light lowercase"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 200,
            marginTop: "-8px",
            marginBottom: "4px",
          }}
        >
         the future of social trading
        </motion.p>

        {/* Launch Button - Lebih kecil di mobile */}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(157, 236, 67, 0.92)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/feed")}
          className="mt-4 px-8 py-3 md:px-10 md:py-4 rounded-full font-semibold text-xs md:text-sm lg:text-base tracking-wide
                     transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, #60f352 0%, #00CC6A 100%)",
            color: "#000000",
            boxShadow: "0 0 30px rgba(0,255,136,0.3)",
            minWidth: "160px",
          }}
        >
          Launch App
        </motion.button>

        {/* Social Links - Jarak lebih rapi */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex items-center gap-5 mt-4"
        >
          <a
            href="https://x.com/xbags_social"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white transition-all duration-300 hover:scale-110"
            aria-label="X (Twitter)"
          >
            <svg className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://t.me/xbags_social"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white transition-all duration-300 hover:scale-110"
            aria-label="Telegram"
          >
            <svg className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>
        </motion.div>
      </motion.div>

      {/* Legal Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute bottom-6 left-0 right-0 z-10 flex flex-col items-center gap-2 px-6"
      >
        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center">
          <a
            href="/license"
            className="text-white/30 hover:text-white/70 transition-colors text-[9px] md:text-[10px] lg:text-xs tracking-widest uppercase font-medium"
          >
            License
          </a>
          <span className="text-white/20 text-[9px] md:text-[10px]">•</span>
          <a
            href="/copyright"
            className="text-white/30 hover:text-white/70 transition-colors text-[9px] md:text-[10px] lg:text-xs tracking-widest uppercase font-medium"
          >
            Copyright
          </a>
          <span className="text-white/20 text-[9px] md:text-[10px]">•</span>
          <a
            href="/privacy-policy"
            className="text-white/30 hover:text-white/70 transition-colors text-[9px] md:text-[10px] lg:text-xs tracking-widest uppercase font-medium"
          >
            Privacy Policy
          </a>
        </div>
        <p className="text-white/25 text-[8px] md:text-[9px] lg:text-[10px] tracking-[0.2em] uppercase font-light">
          © {new Date().getFullYear()} xBAGS. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};

export default LandingPage;