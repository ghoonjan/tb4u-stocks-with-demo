import { NoIndex } from "@/components/NoIndex";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DividendDashboard } from '@/components/dividends/DividendDashboard';
import CopyrightFooter from '@/components/CopyrightFooter';
import { Button } from '@/components/ui/button';

export default function Income() {
  const navigate = useNavigate();
  return (
      <div className="min-h-screen bg-background pb-20">
      <NoIndex />
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
            className="gap-2 -ml-2"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
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
