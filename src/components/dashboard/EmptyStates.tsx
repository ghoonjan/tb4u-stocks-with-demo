import { Plus, Eye, BookOpen, CalendarDays, Target } from "lucide-react";
import { WelcomeAnimation, WatchlistAnimation, JournalAnimation } from "@/components/dashboard/AnimatedEmptyStates";

export function EmptyHoldings({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <WelcomeAnimation className="mb-4" />
      <div className="rounded-2xl bg-primary/10 p-5 mb-5">
        <Target size={36} className="text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">Welcome to TB4U 🎯</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Add your first holding to start tracking your portfolio performance, get AI insights, and monitor the market.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
      >
        <Plus size={16} /> Add Your First Holding
      </button>
    </div>
  );
}

export function EmptyWatchlist({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
      <WatchlistAnimation className="mb-2" />
      <Eye size={22} className="text-muted-foreground/40 mb-2" />
      <p className="text-xs text-muted-foreground mb-1">Start building your watchlist</p>
      <p className="text-[10px] text-muted-foreground/60 mb-3">Track stocks you're considering for your portfolio</p>
      <button onClick={onAdd} className="text-xs text-primary hover:text-primary/80 transition-colors">
        <Plus size={10} className="inline mr-0.5" /> Add a ticker
      </button>
    </div>
  );
}

export function EmptyJournal() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-fade-in">
      <JournalAnimation className="mb-3" />
      <div className="rounded-xl bg-secondary p-4 mb-3">
        <BookOpen size={22} className="text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">No trades logged yet</p>
      <p className="text-xs text-muted-foreground/60 max-w-[240px]">
        Your first logged trade will appear here. Use the "Log Trade" button on any holding to start tracking decisions.
      </p>
    </div>
  );
}

export function EmptyEvents() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4 animate-fade-in">
      <CalendarDays size={24} className="text-muted-foreground/40 mb-2" />
      <p className="text-xs text-muted-foreground">No upcoming events</p>
      <p className="text-[10px] text-muted-foreground/60 mt-1">Add holdings to see upcoming earnings and dividend events.</p>
    </div>
  );
}
