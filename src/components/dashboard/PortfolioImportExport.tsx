import { useState } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  buildExportFilename,
  downloadCsv,
  exportRowsToCsv,
  fetchExportRowsForCurrentUser,
} from "@/lib/portfolioCsv";
import { ImportPortfolioModal } from "./ImportPortfolioModal";

interface Props {
  portfolioId: string | null;
  existingHoldings: { id: string; ticker: string; shares: number; avg_cost_basis: number }[];
  onImported: () => void;
}

export function PortfolioImportExport({ portfolioId, existingHoldings, onImported }: Props) {
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const { rows, error } = await fetchExportRowsForCurrentUser();
    setExporting(false);
    if (error) {
      toast.error("Export failed", { description: error });
      return;
    }
    if (rows.length === 0) {
      toast("Nothing to export", { description: "Your portfolio is empty." });
      return;
    }
    downloadCsv(buildExportFilename(), exportRowsToCsv(rows));
    toast.success(`Exported ${rows.length} tax lots`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="animate-spin" /> : <Download />}
          Export Portfolio
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={!portfolioId}>
          <Upload />
          Import Portfolio
        </Button>
      </div>
      <ImportPortfolioModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        portfolioId={portfolioId}
        existingHoldings={existingHoldings}
        onImported={onImported}
      />
    </>
  );
}
