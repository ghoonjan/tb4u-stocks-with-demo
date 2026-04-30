const buildHash = __BUILD_HASH__;
const buildTime = __BUILD_TIME__;

// Format build time as "YYYY-MM-DD HH:mm UTC" for compact display.
const formattedBuildTime = (() => {
  try {
    const d = new Date(buildTime);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate()
    )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  } catch {
    return buildTime;
  }
})();

const CopyrightFooter = () => (
  <footer className="w-full py-4 px-4 text-center text-xs text-muted-foreground border-t border-border sticky bottom-0 bg-background/80 backdrop-blur-sm z-50">
    <span>© {new Date().getFullYear()} TechBargains4You. All rights reserved.</span>
    <span className="mx-2 opacity-50">·</span>
    <span
      title={`Built ${formattedBuildTime}`}
      className="font-mono opacity-70 whitespace-nowrap"
    >
      v.{buildHash} · {formattedBuildTime}
    </span>
  </footer>
);

export default CopyrightFooter;
