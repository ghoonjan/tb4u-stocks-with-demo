import { DividendDashboard } from '@/components/dividends/DividendDashboard';
import CopyrightFooter from '@/components/CopyrightFooter';

export default function Income() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dividend Income</h1>
          <p className="text-muted-foreground mt-1">
            Track your dividend payments and projected income
          </p>
        </div>
        <DividendDashboard />
      </div>
      <CopyrightFooter />
    </div>
  );
}
