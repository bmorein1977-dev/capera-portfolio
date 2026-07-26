import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Download, ExternalLink } from 'lucide-react';

// Encodes the same URL a phone camera or barcode scanner would open - /badge?userId=X is an
// ordinary authenticated route, gated server-side (self or an elevated role), not a public page.
// There's no separate "badge code" to generate or store; the user's own id is already the
// identifier, so this is pure client-side rendering with no new schema field.
export function CompetenceBadgeQr({ userId, userName }: { userId: string; userName: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const badgeUrl = `${window.location.origin}/badge?userId=${userId}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(badgeUrl, { width: 220, margin: 1 })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [badgeUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${userName.replace(/\s+/g, '-').toLowerCase()}-competence-badge.png`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-4 w-4" /> Competence Badge</CardTitle>
        <CardDescription>Scan to view live training and competence status</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {dataUrl ? (
          <img src={dataUrl} alt="Competence badge QR code" className="rounded border" data-testid="img-badge-qr" width={220} height={220} />
        ) : (
          <div className="h-[220px] w-[220px] flex items-center justify-center border rounded text-muted-foreground text-sm">Generating...</div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!dataUrl} data-testid="button-download-badge-qr">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(badgeUrl, '_blank')} data-testid="button-open-badge">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Badge
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
