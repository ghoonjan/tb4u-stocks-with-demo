import { Link } from "react-router-dom";
import { NoIndex } from "@/components/NoIndex";
import CopyrightFooter from "@/components/CopyrightFooter";

// ============================================================
// EDIT THIS CONFIG TO UPDATE THE ROADMAP — no other changes needed
// ============================================================
const ROADMAP_CONFIG = {
  title: "🚀 Coming Soon",
  subtitle: "Features we're building next",
  lastUpdated: "June 2025",
  contact: {
    show: false,
    text: "Have a suggestion?",
    method: "Contact us",
    link: "",
  },
  categories: [
    {
      name: "In Progress",
      color: "green",
      items: [
        { title: "Multi-Portfolio Support", description: "Manage multiple accounts under one login" },
        { title: "Enhanced Dividend Health Scoring", description: "More accurate payout analysis" },
        { title: "5-Year Income Projection", description: "Visualize your future dividend income" },
      ],
    },
    {
      name: "Planned",
      color: "yellow",
      items: [
        { title: "Stock Analyzer", description: "Research any ticker with key metrics" },
        { title: "Side-by-Side Comparison", description: "Compare up to 3 stocks head-to-head" },
        { title: "Guided Onboarding Tour", description: "Step-by-step walkthrough for new users" },
        { title: "Investing Glossary", description: "Plain-English definitions for every metric" },
      ],
    },
    {
      name: "Exploring",
      color: "blue",
      items: [
        { title: "Dividend Screener", description: "Discover income-generating stocks" },
        { title: "Email Digest Notifications", description: "Weekly portfolio summaries to your inbox" },
        { title: "Public Portfolio Links", description: "Share a read-only view of your portfolio" },
        { title: "Mobile-Optimized Experience", description: "Better layouts for phone screens" },
      ],
    },
  ],
};
// ============================================================

const COLOR_MAP: Record<string, { dot: string; ring: string; text: string }> = {
  green: { dot: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-400" },
  yellow: { dot: "bg-amber-500", ring: "ring-amber-500/30", text: "text-amber-400" },
  blue: { dot: "bg-sky-500", ring: "ring-sky-500/30", text: "text-sky-400" },
  red: { dot: "bg-rose-500", ring: "ring-rose-500/30", text: "text-rose-400" },
  purple: { dot: "bg-violet-500", ring: "ring-violet-500/30", text: "text-violet-400" },
};

const Roadmap = () => {
  const { title, subtitle, lastUpdated, contact, categories } = ROADMAP_CONFIG;

  return (
    <>
      <NoIndex />
      <div className="min-h-screen bg-background text-foreground flex flex-col pb-14">
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <header className="mb-10 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
            <p className="mt-2 text-xs text-muted-foreground/70">Last updated: {lastUpdated}</p>
          </header>

          <div className="space-y-10">
            {categories.map((cat) => {
              const c = COLOR_MAP[cat.color] ?? COLOR_MAP.blue;
              return (
                <section key={cat.name}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.dot} ring-4 ${c.ring}`} />
                    <h2 className={`text-sm font-semibold uppercase tracking-wider ${c.text}`}>{cat.name}</h2>
                  </div>
                  <ul className="space-y-3">
                    {cat.items.map((item) => (
                      <li
                        key={item.title}
                        className="rounded-xl border border-border/60 bg-card p-4 hover:border-border transition-colors"
                      >
                        <h3 className="font-medium text-foreground">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {contact.show && (
            <div className="mt-12 text-center text-sm text-muted-foreground">
              <span>{contact.text} </span>
              {contact.link ? (
                <a
                  href={contact.link}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {contact.method}
                </a>
              ) : (
                <span className="text-foreground">{contact.method}</span>
              )}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to dashboard
            </Link>
          </div>
        </main>
        <CopyrightFooter />
      </div>
    </>
  );
};

export default Roadmap;
