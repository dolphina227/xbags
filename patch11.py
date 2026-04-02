content = open(r'C:\XBAGS V1\src\pages\LandingPage.tsx', encoding='utf-8').read()

old = '''        {/* Social Links - Jarak lebih rapi */}'''

new = '''        {/* Presale Button */}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(157, 236, 67, 0.5)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/presale")}
          className="mt-3 px-8 py-2.5 md:px-10 md:py-3 rounded-full font-semibold text-xs md:text-sm tracking-wide transition-all duration-300 border border-[#60f352]/60 text-[#60f352] hover:bg-[#60f352]/10"
          style={{ minWidth: "160px" }}
        >
          🚀 Join Presale
        </motion.button>

        {/* Social Links - Jarak lebih rapi */}'''

if old in content:
    open(r'C:\XBAGS V1\src\pages\LandingPage.tsx', 'w', encoding='utf-8', newline='\n').write(content.replace(old, new))
    print('LandingPage: Done')
else:
    print('LandingPage: Pattern not found')
